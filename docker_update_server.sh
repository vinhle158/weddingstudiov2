#!/bin/bash
echo "=================================================="
echo "  PULLING AND UPDATING STUDIO V2 ON SERVER"
echo "=================================================="
echo ""

# 1. Pull the latest image
echo "1. Pulling latest image from Docker Hub..."
docker compose -f docker-compose.prod.yml pull

# 2. Restart containers
echo ""
echo "2. Re-creating and restarting containers..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "=================================================="
echo "  UPDATE COMPLETED SUCCESSFULLY!"
echo "=================================================="
