#!/bin/bash
# ConvoGuard EC2 Deployment Script

echo "=========================================================="
echo "    ConvoGuard Deployment Script (AWS EC2 - Free Tier)    "
echo "=========================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    echo "Docker installed. You may need to log out and log back in for group changes to take effect."
fi

# Ensure .env file exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please create a .env file with your DATABASE_URL, REDIS_URL, etc."
    exit 1
fi

echo "Building and starting ConvoGuard backend services..."
docker compose -f docker-compose.prod.yml up -d --build

echo "=========================================================="
echo "Deployment started!"
echo "To view logs, run: docker compose -f docker-compose.prod.yml logs -f"
echo "=========================================================="
