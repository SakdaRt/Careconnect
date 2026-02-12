const run = async () => {
  const response = await fetch('http://localhost:3000/api/auth/login/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@careconnect.com',
      password: 'Admin1234!',
    }),
  });

  const body = await response.text();
  console.log('STATUS', response.status);
  console.log(body);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
