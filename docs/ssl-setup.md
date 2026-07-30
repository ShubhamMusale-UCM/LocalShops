# SSL/TLS Setup

This project includes nginx in docker-compose and exposes ports 80 and 443.

## Option 1: Use Cloud Load Balancer TLS (recommended)

1. Terminate TLS at your cloud load balancer.
2. Forward traffic to nginx on port 80.
3. Set `CORS_ORIGIN` in `.env.production` to your HTTPS domain.

## Option 2: Certbot on host machine

1. Install certbot on host.
2. Issue certs for your domain:
   - `certbot certonly --nginx -d your-domain.com`
3. Mount cert files into nginx container and add SSL server block.
4. Redirect HTTP to HTTPS.

## Security checklist

- Use strong `JWT_SECRET` values in production.
- Restrict database and redis ports to private network.
- Enable regular certificate renewals.
- Keep Docker images updated.
