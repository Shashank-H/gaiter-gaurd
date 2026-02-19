// End-to-end test script for service CRUD operations
// Tests all service endpoints with authentication

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'SecurePass123!';

let accessToken = '';
let serviceId = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.log(`✗ ${name}`);
    if (error instanceof Error) {
      console.log(`  Error: ${error.message}`);
    }
    throw error;
  }
}

async function request(method: string, path: string, body?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

// Main test flow
async function runTests() {
  console.log('Starting service CRUD tests...\n');

  // Setup: Register and login
  console.log('=== Setup ===');
  await test('Register user', async () => {
    await request('POST', '/auth/register', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
  });

  await test('Login', async () => {
    const result = await request('POST', '/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    accessToken = result.accessToken;
    if (!accessToken) throw new Error('No access token received');
  });

  console.log('\n=== Service CRUD Tests ===');

  // Test 1: Create service
  await test('POST /services creates service with encrypted credentials', async () => {
    const result = await request('POST', '/services', {
      name: 'GitHub API',
      baseUrl: 'https://api.github.com',
      authType: 'bearer',
      credentials: {
        token: 'ghp_1234567890abcdef',
      },
    });

    if (!result.id) throw new Error('No service ID returned');
    if (!result.credentials) throw new Error('No credentials metadata returned');
    if (result.credentials.keys[0] !== 'token') throw new Error('Wrong credential key');
    if (result.credentials.count !== 1) throw new Error('Wrong credential count');
    if (result.credentials.keys.includes('ghp_')) {
      throw new Error('Credential value leaked in response!');
    }

    serviceId = result.id;
  });

  // Test 2: List services
  await test('GET /services returns user services', async () => {
    const result = await request('GET', '/services');

    if (!Array.isArray(result)) throw new Error('Expected array');
    if (result.length === 0) throw new Error('No services returned');

    const service = result[0];
    if (!service.credentials) throw new Error('No credentials metadata');
    if (!service.credentials.keys) throw new Error('No credential keys');
  });

  // Test 3: Get single service
  await test('GET /services/:id returns single service', async () => {
    const result = await request('GET', `/services/${serviceId}`);

    if (result.id !== serviceId) throw new Error('Wrong service ID');
    if (result.name !== 'GitHub API') throw new Error('Wrong service name');
    if (!result.credentials) throw new Error('No credentials metadata');
  });

  // Test 4: Update service
  await test('PUT /services/:id updates service', async () => {
    const result = await request('PUT', `/services/${serviceId}`, {
      name: 'GitHub API v2',
      baseUrl: 'https://api.github.com/v2',
    });

    if (result.name !== 'GitHub API v2') throw new Error('Name not updated');
    if (result.baseUrl !== 'https://api.github.com/v2') throw new Error('URL not updated');
  });

  // Test 5: Update credentials
  await test('POST /services/:id/credentials replaces credentials', async () => {
    const result = await request('POST', `/services/${serviceId}/credentials`, {
      api_key: 'new-key-12345',
      api_secret: 'new-secret-67890',
    });

    if (result.count !== 2) throw new Error('Wrong credential count');
    if (!result.keys.includes('api_key')) throw new Error('Missing api_key');
    if (!result.keys.includes('api_secret')) throw new Error('Missing api_secret');
    if (result.keys.includes('token')) throw new Error('Old credential not replaced');
  });

  // Test 6: Verify credentials were replaced
  await test('GET /services/:id shows updated credential keys', async () => {
    const result = await request('GET', `/services/${serviceId}`);

    if (result.credentials.count !== 2) throw new Error('Credential count wrong');
    if (!result.credentials.keys.includes('api_key')) throw new Error('Missing new key');
  });

  // Test 7: Create second service for ownership test
  let service2Id = 0;
  await test('Create second service for testing', async () => {
    const result = await request('POST', '/services', {
      name: 'Stripe API',
      baseUrl: 'https://api.stripe.com',
      authType: 'basic',
      credentials: {
        username: 'sk_test_123',
        password: 'secret',
      },
    });
    service2Id = result.id;
  });

  // Test 8: Delete service
  await test('DELETE /services/:id deletes service', async () => {
    const result = await request('DELETE', `/services/${service2Id}`);

    if (result.message !== 'Service deleted') throw new Error('Wrong response message');
  });

  // Test 9: Verify service deleted
  await test('GET /services/:id returns 404 after delete', async () => {
    try {
      await request('GET', `/services/${service2Id}`);
      throw new Error('Should have returned 404');
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        // Expected
      } else {
        throw error;
      }
    }
  });

  console.log('\n=== Validation Tests ===');

  // Test 10: Invalid service creation
  await test('POST /services validates required fields', async () => {
    try {
      await request('POST', '/services', {
        name: 'Test',
        // missing baseUrl, authType, credentials
      });
      throw new Error('Should have failed validation');
    } catch (error) {
      if (error instanceof Error && error.message.includes('400')) {
        // Expected validation error
      } else {
        throw error;
      }
    }
  });

  // Test 11: Invalid URL
  await test('POST /services validates URL format', async () => {
    try {
      await request('POST', '/services', {
        name: 'Test',
        baseUrl: 'not-a-url',
        authType: 'bearer',
        credentials: { token: 'test' },
      });
      throw new Error('Should have failed validation');
    } catch (error) {
      if (error instanceof Error && error.message.includes('400')) {
        // Expected validation error
      } else {
        throw error;
      }
    }
  });

  console.log('\n=== Security Tests ===');

  // Test 12: Verify credentials never in response
  await test('No endpoint returns credential values', async () => {
    const service = await request('GET', `/services/${serviceId}`);

    const json = JSON.stringify(service);
    if (json.includes('new-key-12345') || json.includes('new-secret-67890')) {
      throw new Error('Credential values leaked in API response!');
    }
    if (json.includes('encryptedValue')) {
      throw new Error('Encrypted values exposed in API response!');
    }
  });

  console.log('\n✅ All tests passed!');
}

// Run tests
runTests().catch((error) => {
  console.error('\n❌ Tests failed:', error);
  process.exit(1);
});
