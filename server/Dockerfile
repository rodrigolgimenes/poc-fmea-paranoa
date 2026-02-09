# Backend API - Node.js + Express + SQL Server
FROM node:20-alpine

# Instalar certificados CA para HTTPS funcionar corretamente
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Criar pasta de uploads
RUN mkdir -p /app/uploads/audio /app/uploads/fotos /app/uploads/outros

# Expor porta
EXPOSE 3001

# Comando para rodar
CMD ["node", "index.js"]
