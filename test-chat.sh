#!/bin/bash
set -e

API_URL="http://localhost:3000/api"

echo "========================================"
echo "Testing Chat API"
echo "========================================"

# Step 1: Register hirer
echo -e "\n--- 1. Register Hirer ---"
HIRER_RESULT=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "chat-hirer@test.com",
    "password": "password123",
    "role": "hirer",
    "consent_terms": true,
    "consent_privacy": true
  }')
echo "$HIRER_RESULT" | jq -r '.message // .error'
HIRER_TOKEN=$(echo "$HIRER_RESULT" | jq -r '.token // empty')

if [ -z "$HIRER_TOKEN" ]; then
  echo "Login existing hirer..."
  HIRER_RESULT=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "chat-hirer@test.com", "password": "password123"}')
  HIRER_TOKEN=$(echo "$HIRER_RESULT" | jq -r '.token')
fi
HIRER_ID=$(echo "$HIRER_RESULT" | jq -r '.user.id')
echo "Hirer ID: $HIRER_ID"

# Step 2: Register caregiver
echo -e "\n--- 2. Register Caregiver ---"
CAREGIVER_RESULT=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "chat-caregiver@test.com",
    "password": "password123",
    "role": "caregiver",
    "consent_terms": true,
    "consent_privacy": true
  }')
echo "$CAREGIVER_RESULT" | jq -r '.message // .error'
CAREGIVER_TOKEN=$(echo "$CAREGIVER_RESULT" | jq -r '.token // empty')

if [ -z "$CAREGIVER_TOKEN" ]; then
  echo "Login existing caregiver..."
  CAREGIVER_RESULT=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "chat-caregiver@test.com", "password": "password123"}')
  CAREGIVER_TOKEN=$(echo "$CAREGIVER_RESULT" | jq -r '.token')
fi
CAREGIVER_ID=$(echo "$CAREGIVER_RESULT" | jq -r '.user.id')
echo "Caregiver ID: $CAREGIVER_ID"

# Step 3: Create and publish job
echo -e "\n--- 3. Create Job ---"
JOB_RESULT=$(curl -s -X POST "$API_URL/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HIRER_TOKEN" \
  -d '{
    "title": "Chat Test Job",
    "description": "Testing chat functionality",
    "job_type": "companionship",
    "risk_level": "low_risk",
    "scheduled_start_at": "2026-01-15T09:00:00Z",
    "scheduled_end_at": "2026-01-15T17:00:00Z",
    "address_line1": "123 Chat Street",
    "district": "Chatuchak",
    "province": "Bangkok",
    "postal_code": "10900",
    "hourly_rate": 300,
    "total_hours": 8
  }')
echo "$JOB_RESULT" | jq -r '.message // .error'
JOB_ID=$(echo "$JOB_RESULT" | jq -r '.job.id // empty')

if [ -z "$JOB_ID" ]; then
  echo "Error: Failed to create job"
  exit 1
fi
echo "Job ID: $JOB_ID"

# Step 4: Publish job
echo -e "\n--- 4. Publish Job ---"
PUBLISH_RESULT=$(curl -s -X POST "$API_URL/jobs/$JOB_ID/publish" \
  -H "Authorization: Bearer $HIRER_TOKEN")
echo "$PUBLISH_RESULT" | jq -r '.message // .error'

# Step 5: Accept job
echo -e "\n--- 5. Accept Job ---"
ACCEPT_RESULT=$(curl -s -X POST "$API_URL/jobs/$JOB_ID/accept" \
  -H "Authorization: Bearer $CAREGIVER_TOKEN")
echo "$ACCEPT_RESULT" | jq -r '.message // .error'

# Step 6: Get or create chat thread for job (Hirer)
echo -e "\n--- 6. Get/Create Chat Thread (Hirer) ---"
THREAD_RESULT=$(curl -s -X POST "$API_URL/chat/job/$JOB_ID/thread" \
  -H "Authorization: Bearer $HIRER_TOKEN")
echo "$THREAD_RESULT" | jq '{success, thread_id: .thread.id, job_title: .thread.job_title}'
THREAD_ID=$(echo "$THREAD_RESULT" | jq -r '.thread.id')

if [ -z "$THREAD_ID" ] || [ "$THREAD_ID" == "null" ]; then
  echo "Error: Failed to get/create thread"
  exit 1
fi
echo "Thread ID: $THREAD_ID"

# Step 7: Caregiver accesses thread
echo -e "\n--- 7. Caregiver Access Thread ---"
CAREGIVER_THREAD=$(curl -s "$API_URL/chat/job/$JOB_ID/thread" \
  -H "Authorization: Bearer $CAREGIVER_TOKEN")
echo "$CAREGIVER_THREAD" | jq '{success, thread_id: .thread.id}'

# Step 8: Hirer sends message
echo -e "\n--- 8. Hirer Sends Message ---"
MSG1_RESULT=$(curl -s -X POST "$API_URL/chat/threads/$THREAD_ID/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HIRER_TOKEN" \
  -d '{"content": "Hello! I am looking forward to working with you."}')
echo "$MSG1_RESULT" | jq '{success, message_id: .message.id, sender_name: .message.sender_name}'
MSG1_ID=$(echo "$MSG1_RESULT" | jq -r '.message.id')

# Step 9: Caregiver sends message
echo -e "\n--- 9. Caregiver Sends Message ---"
MSG2_RESULT=$(curl -s -X POST "$API_URL/chat/threads/$THREAD_ID/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CAREGIVER_TOKEN" \
  -d '{"content": "Thank you! I am excited to help."}')
echo "$MSG2_RESULT" | jq '{success, message_id: .message.id, sender_name: .message.sender_name}'

# Step 10: Send another message from hirer
echo -e "\n--- 10. Hirer Sends Another Message ---"
MSG3_RESULT=$(curl -s -X POST "$API_URL/chat/threads/$THREAD_ID/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HIRER_TOKEN" \
  -d '{"content": "Please arrive at 9 AM sharp."}')
echo "$MSG3_RESULT" | jq '{success, message_id: .message.id}'

# Step 11: Get messages
echo -e "\n--- 11. Get Messages ---"
MESSAGES_RESULT=$(curl -s "$API_URL/chat/threads/$THREAD_ID/messages" \
  -H "Authorization: Bearer $HIRER_TOKEN")
echo "$MESSAGES_RESULT" | jq '{success, total: .total, messages: [.data[] | {type, content: (.content | .[0:50]), sender_name, sender_role}]}'

# Step 12: Mark message as read
echo -e "\n--- 12. Mark Message as Read ---"
READ_RESULT=$(curl -s -X POST "$API_URL/chat/threads/$THREAD_ID/read" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CAREGIVER_TOKEN" \
  -d "{\"message_id\": \"$MSG1_ID\"}")
echo "$READ_RESULT" | jq '{success, read_at}'

# Step 13: Get unread count
echo -e "\n--- 13. Get Unread Count ---"
UNREAD_RESULT=$(curl -s "$API_URL/chat/threads/$THREAD_ID/unread?since=2026-01-01T00:00:00Z" \
  -H "Authorization: Bearer $CAREGIVER_TOKEN")
echo "$UNREAD_RESULT" | jq '{success, unread_count}'

# Step 14: Get user threads
echo -e "\n--- 14. Get User Threads (Hirer) ---"
THREADS_RESULT=$(curl -s "$API_URL/chat/threads" \
  -H "Authorization: Bearer $HIRER_TOKEN")
echo "$THREADS_RESULT" | jq '{success, total, threads: [.data[] | {job_title, last_message: (.last_message | .[0:30]), message_count}]}'

# Step 15: Get thread by ID
echo -e "\n--- 15. Get Thread By ID ---"
THREAD_DETAIL=$(curl -s "$API_URL/chat/threads/$THREAD_ID" \
  -H "Authorization: Bearer $HIRER_TOKEN")
echo "$THREAD_DETAIL" | jq '{success, thread: {id: .thread.id, job_title: .thread.job_title, hirer_name: .thread.hirer_name, caregiver_name: .thread.caregiver_name}}'

# Step 16: Test access denied (new user tries to access)
echo -e "\n--- 16. Test Access Denied ---"
# Register new user
NEW_USER=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "unauthorized@test.com",
    "password": "password123",
    "role": "hirer",
    "consent_terms": true,
    "consent_privacy": true
  }')
NEW_TOKEN=$(echo "$NEW_USER" | jq -r '.token // empty')
if [ -z "$NEW_TOKEN" ]; then
  NEW_USER=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "unauthorized@test.com", "password": "password123"}')
  NEW_TOKEN=$(echo "$NEW_USER" | jq -r '.token')
fi

DENIED_RESULT=$(curl -s "$API_URL/chat/threads/$THREAD_ID" \
  -H "Authorization: Bearer $NEW_TOKEN")
echo "$DENIED_RESULT" | jq '{success, error}'

echo -e "\n========================================"
echo "Chat API Tests Complete!"
echo "========================================"
