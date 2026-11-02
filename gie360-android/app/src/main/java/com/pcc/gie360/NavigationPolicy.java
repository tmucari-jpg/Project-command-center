package com.pcc.gie360;

import java.net.URI;
import java.net.URISyntaxException;

/** Navigation authorization only; APIs still enforce server identity and RLS. */
final class NavigationPolicy {
    static boolean permits(String configuredUrl, String targetUrl) {
        try {
            URI base = new URI(configuredUrl);
            URI target = new URI(targetUrl);
            String path = target.getRawPath();
            if (!"https".equalsIgnoreCase(base.getScheme()) || base.getHost() == null ||
                !"https".equalsIgnoreCase(target.getScheme()) || target.getHost() == null ||
                !base.getHost().equalsIgnoreCase(target.getHost()) ||
                base.getRawUserInfo() != null || target.getRawUserInfo() != null ||
                !normalPort(base).equals(normalPort(target)) || path == null) return false;
            // Reject encoded separators and dot traversal before checking the product boundary.
            String lower = path.toLowerCase(java.util.Locale.ROOT);
            if (lower.contains("%") || path.contains("\\") || !path.equals(target.normalize().getRawPath())) return false;
            return path.equals("/gie360") || path.startsWith("/gie360/");
        } catch (URISyntaxException | IllegalArgumentException exception) {
            return false;
        }
    }

    private static Integer normalPort(URI uri) {
        return uri.getPort() == -1 ? 443 : uri.getPort();
    }
}
