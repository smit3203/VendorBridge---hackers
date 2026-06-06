#!/bin/bash
echo "=== VendorBridge Setup ==="
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
cp .env.example .env 2>/dev/null || true
mkdir -p server/uploads/invoices
touch server/uploads/invoices/.gitkeep
echo ""
echo "Seeding database..."
npm run seed
echo ""
echo "=== Setup Complete ==="
echo "Run 'npm run dev' to start the application"
