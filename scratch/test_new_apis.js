const BASE_URL = 'http://localhost:3000/api';

async function runTests() {
  try {
    console.log('--- TEST 1: Register Customer ---');
    const registerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number: '081234567890',
        name: 'Bagus Mahasiswa'
      })
    });
    const registerData = await registerRes.json();
    console.log('Register Response:', registerData);

    console.log('\n--- TEST 2: Login Customer ---');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number: '081234567890'
      })
    });
    const loginData = await loginRes.json();
    console.log('Login Response:', loginData);
    const userId = loginData.user ? loginData.user.id : null;

    if (!userId) {
      throw new Error('User registration/login failed, no userId');
    }

    console.log('\n--- TEST 3: Get Leaderboard ---');
    const leaderboardRes = await fetch(`${BASE_URL}/leaderboard`);
    const leaderboardData = await leaderboardRes.json();
    console.log('Leaderboard Response (First 3):', leaderboardData.slice(0, 3));

    console.log('\n--- TEST 4: Save Study Session ---');
    const studyRes = await fetch(`${BASE_URL}/users/${userId}/study-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Kalkulus II',
        duration_minutes: 90,
        points_earned: 45
      })
    });
    const studyData = await studyRes.json();
    console.log('Study Session Response:', studyData);

    console.log('\n--- TEST 5: Get Study History ---');
    const historyRes = await fetch(`${BASE_URL}/users/${userId}/study-sessions`);
    const historyData = await historyRes.json();
    console.log('Study History Response:', historyData);

    console.log('\n--- TEST 6: Get Patungan Rooms ---');
    const roomsRes = await fetch(`${BASE_URL}/patungan-rooms`);
    const roomsData = await roomsRes.json();
    console.log('Patungan Rooms Response:', roomsData);

    if (roomsData.length > 0) {
      const roomId = roomsData[0].id;
      console.log(`\n--- TEST 7: Contribute to Room ${roomId} ---`);
      const contributeRes = await fetch(`${BASE_URL}/patungan-rooms/${roomId}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          amount: 20
        })
      });
      const contributeData = await contributeRes.json();
      console.log('Contribute Response:', contributeData);
    }

    console.log('\n--- ALL TESTS COMPLETED SUCCESSFULLY ---');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTests();
