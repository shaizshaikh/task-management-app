# ---- Stage 1: Dependencies ----
FROM node:18-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies with maximum optimization
RUN npm ci --omit=dev --no-audit --no-fund && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/* /var/cache/apk/*

# ---- Stage 2: Runtime ----
FROM node:18-alpine AS runtime

# Install only dumb-init and clean up immediately
RUN apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/* /tmp/* /usr/share/man /usr/share/doc

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Set optimized environment variables
ENV NODE_ENV=production \
    PORT=5000 \
    NODE_OPTIONS="--max-old-space-size=256" \
    NPM_CONFIG_LOGLEVEL=warn

# Copy only essential files
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Create directories and final cleanup in single layer
RUN mkdir -p uploads/temp uploads/attachments && \
    chown -R nodejs:nodejs uploads && \
    chmod 755 uploads && \
    rm -rf /tmp/* /var/cache/apk/* /usr/local/share/.cache

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Minimal health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=2 \
  CMD node -e "require('http').get('http://localhost:5000/health',(r)=>process.exit(r.statusCode===200?0:1))" || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "server.js"]