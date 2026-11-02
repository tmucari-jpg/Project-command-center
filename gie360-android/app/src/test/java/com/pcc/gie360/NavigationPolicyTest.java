package com.pcc.gie360;

import org.junit.Test;
import static org.junit.Assert.*;

public class NavigationPolicyTest {
    private final String base = "https://test.example/gie360";
    @Test public void allowsOnlyProductNavigation() {
        assertTrue(NavigationPolicy.permits(base, base));
        assertTrue(NavigationPolicy.permits(base, base + "/login?next=%2Fgie360"));
        assertTrue(NavigationPolicy.permits(base, "https://test.example:443/gie360/imports"));
        assertFalse(NavigationPolicy.permits(base, "https://test.example/dashboard"));
        assertFalse(NavigationPolicy.permits(base, "https://test.example/auth/login"));
        assertFalse(NavigationPolicy.permits(base, "https://test.example/gie360evil"));
    }
    @Test public void rejectsOriginAndTraversalBypasses() {
        String[] denied = { "http://test.example/gie360", "https://evil.example/gie360",
            "https://test.example.evil/gie360", "https://test.example:444/gie360",
            "https://evil@test.example/gie360", "https://test.example/gie360/../dashboard",
            "https://test.example/gie360/%2e%2e/dashboard", "https://test.example/gie360/%2f../dashboard",
            "javascript:alert(1)", "file:///gie360", "not a URL" };
        for (String url : denied) assertFalse(url, NavigationPolicy.permits(base, url));
    }
}
