#!/bin/bash

# Simple API Testing Script
# Tests the key endpoints of the Enterprise Multi-MCP Smart Database API

echo "🚀 Testing Enterprise Multi-MCP Smart Database API"
echo "=================================================="

API_BASE="http://localhost:3000"

# Test 1: Health Check
echo "1. Testing Health Check..."
curl -s -w "\nHTTP Status: %{http_code}\n" "$API_BASE/health" | head -5
echo ""

# Test 2: API Root
echo "2. Testing API Root..."
curl -s -w "\nHTTP Status: %{http_code}\n" "$API_BASE/" | head -5
echo ""

# Test 3: Authentication Login (mock data)
echo "3. Testing Authentication Login..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  "$API_BASE/api/v1/auth/login" | head -5
echo ""

# Test 4: Query Examples (no auth required)
echo "4. Testing Query Examples..."
curl -s -w "\nHTTP Status: %{http_code}\n" "$API_BASE/api/v1/query/examples" | head -5
echo ""

# Test 5: API Documentation
echo "5. Testing API Documentation..."
curl -s -w "\nHTTP Status: %{http_code}\n" "$API_BASE/api-docs.json" | head -1
echo ""

# Test 6: WebSocket Test (basic)
echo "6. Testing WebSocket Availability..."
curl -s -I "$API_BASE/socket.io/?EIO=4&transport=polling" | grep "HTTP"
echo ""

echo "✅ API Testing Complete!"
echo ""
echo "📍 Available Endpoints:"
echo "  • Health: $API_BASE/health"
echo "  • Docs: $API_BASE/api-docs"
echo "  • Auth: $API_BASE/api/v1/auth/login"
echo "  • Ingest: $API_BASE/api/v1/ingest/single"
echo "  • Query: $API_BASE/api/v1/query/natural"
echo "  • Admin: $API_BASE/api/v1/admin/mcps"