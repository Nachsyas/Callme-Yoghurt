# Callme Yoghurt ERP Core — DNS Configuration Guide

> **Target Hostname**: `staging-erp.callmeyoghurt.com`  
> **Status**: PENDING OWNER HOST SELECTION  
> **Policy**: Do NOT change or register DNS records until the hosting provider and infrastructure are approved by the business owner.

---

## Architecture Context

The Next.js storefront and BFF hosted on Vercel communicates with the backend ERP core over HTTPS via:
```
https://staging-erp.callmeyoghurt.com
```

DNS resolution is currently not configured for this subdomain. Depending on the hosting architecture chosen by the owner, configure one of the following two standard patterns in your authoritative DNS manager (Cloudflare, Route53, Namecheap, etc.):

---

## Supported Pattern A: CNAME (Managed Platform / PaaS / Ingress)

Use this pattern if the ERP is deployed to a PaaS (e.g. AWS App Runner, Google Cloud Run with custom domain, Fly.io, Railway, Render) or behind a Cloudflare Tunnel:

| Record Type | Host / Name | Target / Content | TTL | Proxy Status |
| :--- | :--- | :--- | :--- | :--- |
| `CNAME` | `staging-erp` | `<provider-assigned-hostname>` *(e.g., custom.app.railway.app, cname.render.com, etc.)* | Auto / 300 | Proxied (if Cloudflare) or DNS only per provider requirements |

### Requirements:
- Replace `<provider-assigned-hostname>` with the actual hostname provided by the hosting platform.
- Managed SSL certificates will automatically provision via the PaaS or Cloudflare.
- Enforce HTTPS only (TLS 1.2+).

---

## Supported Pattern B: A / AAAA (Dedicated Server / Low-Cost VPS)

Use this pattern if the ERP is deployed to an owner-selected Linux VPS (e.g. Hetzner, DigitalOcean, Linode, AWS EC2, VPS provider):

| Record Type | Host / Name | Target / Content | TTL | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `A` | `staging-erp` | `<owner-selected-server-ipv4>` | Auto / 300 | Primary IPv4 address |
| `AAAA` (Optional) | `staging-erp` | `<owner-selected-server-ipv6>` | Auto / 300 | IPv6 address if assigned |

### Requirements:
- Replace `<owner-selected-server-ipv4>` with the static public IP assigned to the server.
- The server must run a reverse proxy (e.g., Caddy, Nginx + Certbot) with an active TLS certificate for `staging-erp.callmeyoghurt.com`.
- Automatic HTTP-to-HTTPS redirect (port 80 -> port 443) is mandatory.

---

## Verification After DNS Update

Once the owner provisions the host and DNS is propagated, verify resolution:

```bash
# 1. Verify DNS A/CNAME record resolution
dig +short staging-erp.callmeyoghurt.com

# 2. Verify TLS certificate and HTTPS reachability
curl -fsSL -I https://staging-erp.callmeyoghurt.com/api/health

# 3. Expected HTTP response
# HTTP/2 200 (or HTTP/1.1 200)
# {"status":"ok","service":"erp-core"}
```
