package api

import (
	"compress/gzip"
	"compress/zlib"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/sipeed/picoclaw/pkg/config"
	"github.com/sipeed/picoclaw/pkg/logger"
)

func (h *Handler) registerProxyRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/proxy/browse", h.handleBrowseProxy)
	mux.HandleFunc("POST /api/proxy/browse", h.handleBrowseProxy)
	mux.HandleFunc("HEAD /api/proxy/browse", h.handleBrowseProxy)
}

func (h *Handler) handleBrowseProxy(w http.ResponseWriter, r *http.Request) {
	targetRaw := strings.TrimSpace(r.URL.Query().Get("url"))

	if targetRaw == "" {
		if ref := r.Header.Get("Referer"); ref != "" {
			if parsedRef, err := url.Parse(ref); err == nil {
				if orig := parsedRef.Query().Get("url"); orig != "" {
					if base, err := url.Parse(orig); err == nil {
						targetRaw = base.ResolveReference(r.URL).String()
					}
				}
			}
		}
	}

	if targetRaw == "" {
		http.Error(w, "missing target url query parameter", http.StatusBadRequest)
		return
	}

	if strings.HasPrefix(targetRaw, "/") {
		gw := h.gatewayProxyURL()
		targetRaw = fmt.Sprintf("%s://%s%s", gw.Scheme, gw.Host, targetRaw)
	} else if !strings.HasPrefix(targetRaw, "http://") && !strings.HasPrefix(targetRaw, "https://") {
		targetRaw = "http://" + targetRaw
	}

	parsedTarget, err := url.Parse(targetRaw)
	if err != nil || (parsedTarget.Scheme != "http" && parsedTarget.Scheme != "https") {
		http.Error(w, "invalid target url scheme, only http/https supported", http.StatusBadRequest)
		return
	}

	cfg, _ := config.LoadConfig(h.configPath)
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		MaxIdleConns:          20,
		IdleConnTimeout:       30 * time.Second,
		ResponseHeaderTimeout: 20 * time.Second,
	}

	if cfg != nil && strings.TrimSpace(cfg.Tools.Web.Proxy) != "" {
		if proxyURL, pErr := url.Parse(strings.TrimSpace(cfg.Tools.Web.Proxy)); pErr == nil {
			transport.Proxy = http.ProxyURL(proxyURL)
		}
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("stopped after 10 redirects")
			}
			return nil
		},
	}

	outReq, err := http.NewRequestWithContext(r.Context(), r.Method, parsedTarget.String(), r.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to create request: %v", err), http.StatusBadRequest)
		return
	}

	outReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36")
	outReq.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
	outReq.Header.Set("Accept-Language", "en-US,en;q=0.9")

	gw := h.gatewayProxyURL()
	if parsedTarget.Host == gw.Host || strings.HasPrefix(parsedTarget.Host, "127.0.0.1:18790") || strings.HasPrefix(parsedTarget.Host, "localhost:18790") {
		gateway.mu.Lock()
		if gateway.pidData != nil && gateway.pidData.Token != "" {
			outReq.Header.Set("Authorization", "Bearer "+gateway.pidData.Token)
		}
		gateway.mu.Unlock()
	}

	resp, err := client.Do(outReq)
	if err != nil {
		logger.Warnf("browse proxy request failed for %s: %v", parsedTarget.String(), err)
		http.Error(w, fmt.Sprintf("gateway proxy error: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Decompress response body if needed
	var reader io.Reader = resp.Body
	contentEncoding := strings.ToLower(resp.Header.Get("Content-Encoding"))
	if strings.Contains(contentEncoding, "gzip") {
		if gz, gzErr := gzip.NewReader(resp.Body); gzErr == nil {
			defer gz.Close()
			reader = gz
		}
	} else if strings.Contains(contentEncoding, "deflate") {
		if zr, zrErr := zlib.NewReader(resp.Body); zrErr == nil {
			defer zr.Close()
			reader = zr
		}
	}

	bodyBytes, readErr := io.ReadAll(reader)
	if readErr != nil {
		http.Error(w, fmt.Sprintf("failed to read response: %v", readErr), http.StatusInternalServerError)
		return
	}

	// Copy non-restrictive headers from upstream
	for k, vv := range resp.Header {
		lk := strings.ToLower(k)
		if lk == "x-frame-options" ||
			lk == "content-security-policy" ||
			lk == "content-security-policy-report-only" ||
			lk == "cross-origin-opener-policy" ||
			lk == "cross-origin-embedder-policy" ||
			lk == "cross-origin-resource-policy" ||
			lk == "permissions-policy" ||
			lk == "content-disposition" ||
			lk == "x-content-type-options" ||
			lk == "content-encoding" ||
			lk == "content-length" {
			continue
		}
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Del("Content-Security-Policy")
	w.Header().Del("X-Frame-Options")
	w.Header().Del("X-Content-Type-Options")
	w.Header().Del("Content-Disposition")
	w.Header().Del("Content-Encoding")
	w.Header().Del("Content-Length")

	cType := strings.ToLower(resp.Header.Get("Content-Type"))
	sniffLen := len(bodyBytes)
	if sniffLen > 512 {
		sniffLen = 512
	}
	bodyPrefix := strings.TrimSpace(strings.ToLower(string(bodyBytes[:sniffLen])))
	isHTML := strings.Contains(cType, "text/html") ||
		strings.Contains(cType, "application/xhtml+xml") ||
		strings.HasPrefix(bodyPrefix, "<!doctype html") ||
		strings.HasPrefix(bodyPrefix, "<html") ||
		strings.Contains(bodyPrefix, "<head") ||
		strings.Contains(bodyPrefix, "<body")

	if !isHTML {
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write(bodyBytes)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	htmlStr := string(bodyBytes)
	baseURL := parsedTarget.String()
	if resp.Request != nil && resp.Request.URL != nil {
		baseURL = resp.Request.URL.String()
	}

	injection := fmt.Sprintf(`
<base href="%s">
<script>
(function() {
  var origPushState = history.pushState;
  var origReplaceState = history.replaceState;
  function safeUrl(u) {
    if (!u) return u;
    try {
      var parsed = new URL(u, window.location.href);
      if (parsed.origin !== window.location.origin) {
        return window.location.pathname + window.location.search;
      }
      return u;
    } catch (_) {
      return window.location.pathname + window.location.search;
    }
  }
  history.pushState = function(state, title, url) {
    try {
      return origPushState.call(this, state, title, safeUrl(url));
    } catch (_) {}
  };
  history.replaceState = function(state, title, url) {
    try {
      return origReplaceState.call(this, state, title, safeUrl(url));
    } catch (_) {}
  };
  document.addEventListener('click', function(e) {
    try {
      window.parent.postMessage({
        type: 'agy-browser-click',
        clientX: e.clientX,
        clientY: e.clientY,
        targetTag: e.target ? e.target.tagName : '',
        targetText: e.target ? (e.target.innerText || e.target.value || '').slice(0, 30) : ''
      }, '*');
    } catch (_) {}
    var a = e.target.closest('a');
    if (a && a.href && !a.href.startsWith('javascript:') && !a.href.startsWith('#')) {
      e.preventDefault();
      window.location.href = '/api/proxy/browse?url=' + encodeURIComponent(a.href);
    }
  }, true);
})();
</script>`, baseURL)

	headIdx := strings.Index(strings.ToLower(htmlStr), "<head>")
	if headIdx != -1 {
		insertAt := headIdx + 6
		htmlStr = htmlStr[:insertAt] + injection + htmlStr[insertAt:]
	} else {
		htmlStr = injection + htmlStr
	}

	if resp.StatusCode >= 400 {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(resp.StatusCode)
	}
	_, _ = w.Write([]byte(htmlStr))
}
