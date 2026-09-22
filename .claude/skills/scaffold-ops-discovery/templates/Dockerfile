# ops-discovery — STD-032. Service isomorphique, sans dependance Somtech (I6) :
# zero paquet npm (Node built-in http seulement), pour demarrer meme sur un hote
# sans acces reseau sortant (Mac Studio derriere Tailscale, mode "network", SS2.5).
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY config.example.yaml ./config.yaml

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('node:http').get('http://localhost:8080/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
