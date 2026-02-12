#!/bin/bash
# E2E Test Script for Careconnect Job Flow

BASE_URL="http://localhost:3000"
RANDOM_SUFFIX=$RANDOM

echo "=== Careconnect E2E Test ==="
echo ""

# 1. Register Hirer
echo "--- 1. Register Hirer ---"
HIRER_RESP=$(curl -s -X POST "$BASE_URL/api/auth/register/member" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"hirer_${RANDOM_SUFFIX}@test.com\",\"password\":\"Test123!\",\"phone_number\":\"+66800001111\",\"role\":\"hirer\",\"first_name\":\"Hirer\",\"last_name\":\"Test\"}")
echo "$HIRER_RESP" | head -c 200
echo ""
HIRER_TOKEN=$(echo "$HIRER_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
HIRER_ID=$(echo "$HIRER_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Hirer ID: $HIRER_ID"
echo ""

# 2. Register Caregiver
echo "--- 2. Register Caregiver ---"
CAREGIVER_RESP=$(curl -s -X POST "$BASE_URL/api/auth/register/member" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"caregiver_${RANDOM_SUFFIX}@test.com\",\"password\":\"Test123!\",\"phone_number\":\"+66800002222\",\"role\":\"caregiver\",\"first_name\":\"Caregiver\",\"last_name\":\"Test\"}")
echo "$CAREGIVER_RESP" | head -c 200
echo ""
CAREGIVER_TOKEN=$(echo "$CAREGIVER_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
CAREGIVER_ID=$(echo "$CAREGIVER_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Caregiver ID: $CAREGIVER_ID"
echo ""

# 3. Get Hirer Wallet Balance
echo "--- 3. Get Hirer Wallet Balance ---"
curl -s "$BASE_URL/api/wallet/balance" -H "Authorization: Bearer $HIRER_TOKEN"
echo ""
echo ""

# 4. Create Job
echo "--- 4. Create Job ---"
JOB_RESP=$(curl -s -X POST "$BASE_URL/api/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HIRER_TOKEN" \
  -d '{
    "title": "Elderly Care Test Job",
    "description": "Test job for E2E testing",
    "job_type": "one_time",
    "urgency_level": "normal",
    "start_datetime": "2026-01-15T09:00:00Z",
    "end_datetime": "2026-01-15T17:00:00Z",
    "hourly_rate": 300,
    "estimated_hours": 8,
    "lat": 13.7563,
    "lng": 100.5018,
    "address": "Bangkok, Thailand",
    "required_certifications": []
  }')
echo "$JOB_RESP" | head -c 300
echo ""
JOB_ID=$(echo "$JOB_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Job ID: $JOB_ID"
echo ""

# 5. Post Job
echo "--- 5. Post Job ---"
curl -s -X POST "$BASE_URL/api/jobs/$JOB_ID/post" \
  -H "Authorization: Bearer $HIRER_TOKEN"
echo ""
echo ""

# 6. List Available Jobs (as caregiver)
echo "--- 6. List Available Jobs ---"
curl -s "$BASE_URL/api/jobs?status=posted" \
  -H "Authorization: Bearer $CAREGIVER_TOKEN"
echo ""
echo ""

# 7. Accept Job (as caregiver)
echo "--- 7. Accept Job ---"
ACCEPT_RESP=$(curl -s -X POST "$BASE_URL/api/jobs/$JOB_ID/accept" \
  -H "Authorization: Bearer $CAREGIVER_TOKEN")
echo "$ACCEPT_RESP"
echo ""

# 8. Get Job Status
echo "--- 8. Get Job Status ---"
curl -s "$BASE_URL/api/jobs/$JOB_ID" \
  -H "Authorization: Bearer $CAREGIVER_TOKEN"
echo ""
echo ""

# 9. Check In
echo "--- 9. Check In ---"
CHECKIN_RESP=$(curl -s -X POST "$BASE_URL/api/jobs/$JOB_ID/checkin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CAREGIVER_TOKEN" \
  -d '{"lat": 13.7563, "lng": 100.5018, "accuracy_m": 10}')
echo "$CHECKIN_RESP"
echo ""

# 10. Get Job Status After Check-in
echo "--- 10. Job Status After Check-in ---"
curl -s "$BASE_URL/api/jobs/$JOB_ID" \
  -H "Authorization: Bearer $CAREGIVER_TOKEN"
echo ""
echo ""

# 11. Check Out
echo "--- 11. Check Out ---"
CHECKOUT_RESP=$(curl -s -X POST "$BASE_URL/api/jobs/$JOB_ID/checkout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CAREGIVER_TOKEN" \
  -d '{"lat": 13.7563, "lng": 100.5018, "accuracy_m": 10}')
echo "$CHECKOUT_RESP"
echo ""

# 12. Final Job Status
echo "--- 12. Final Job Status ---"
curl -s "$BASE_URL/api/jobs/$JOB_ID" \
  -H "Authorization: Bearer $HIRER_TOKEN"
echo ""
echo ""

echo "=== E2E Test Complete ==="
