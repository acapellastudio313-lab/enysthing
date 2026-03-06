async function testApi() {
  try {
    const response = await fetch('http://localhost:3000/api/users');
    const data = await response.json();
    console.log('Users:', data);
  } catch (e) {
    console.error('Error:', e);
  }
}
testApi();
