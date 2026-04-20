-- Prosody XMPP Server Configuration (stub)
-- Minimal configuration for development with s2s (server-to-server) federation enabled

-- Run in foreground for Docker
daemonize = false

-- Logging to console (Docker)
log = {
  info = "*console";
  error = "*console";
}

-- Allow unencrypted authentication for development
allow_unencrypted_plain_auth = true

-- VirtualHost for the main XMPP domain
VirtualHost "chatrix.local"
  modules_enabled = {
    "roster";      -- Contact list
    "saslauth";    -- SASL authentication
    "tls";         -- TLS support
    "dialback";    -- XEP-0220 server verification
    "s2s";         -- Server-to-server federation
    "carbons";     -- Message carbons (sync across resources)
  }

-- Server-to-server (s2s) federation settings
s2s_enabled = true
allow_s2s_insecure_domains = { "chatrix.local" }
s2s_insecure_domains = { "chatrix.local" }

-- XMPP component (XEP-0114 Component protocol)
-- This stub declares the component listener on the conventional port 5275
-- The backend bridge will connect to this component to relay messages
Component "xmpp.chatrix.local"
  component_secret = "change-me-dev-only"
