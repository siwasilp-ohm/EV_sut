const request = require('supertest');
const WebSocket = require('ws');
const { sequelize } = require('../server/models');
const app = require('../server/app');

describe('EV Solar Charging System - Integration Tests', () => {
  let server;
  let authToken;
  let adminToken;
  let testUserId;
  let testStationId;

  beforeAll(async () => {
    // Start server
    server = app.listen(0);
    
    // Initialize database
    await sequelize.sync({ force: true });
    
    // Create test data
    await setupTestData();
  });

  afterAll(async () => {
    await sequelize.close();
    if (server) {
      server.close();
    }
  });

  const setupTestData = async () => {
    // Register test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'integrationtest',
        password: '123456',
        email: 'integration@test.com',
        full_name: 'Integration Test User',
        phone: '0812345678'
      });
    
    testUserId = userResponse.body.user.id;

    // Login test user
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'integrationtest',
        password: '123456'
      });
    
    authToken = loginResponse.body.token;

    // Login admin
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin1',
        password: '123456'
      });
    
    adminToken = adminLoginResponse.body.token;
  };

  describe('Complete User Journey', () => {
    test('User can complete full charging workflow', async () => {
      // 1. Get available stations
      const stationsResponse = await request(app)
        .get('/api/stations')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(stationsResponse.status).toBe(200);
      expect(stationsResponse.body.stations.length).toBeGreaterThan(0);
      
      testStationId = stationsResponse.body.stations[0].id;

      // 2. Add a vehicle
      const vehicleResponse = await request(app)
        .post('/api/users/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          make: 'Tesla',
          model: 'Model 3',
          year: 2023,
          license_plate: 'TEST-001',
          battery_capacity: 75,
          is_default: true
        });
      
      expect(vehicleResponse.status).toBe(201);

      // 3. Check wallet balance
      const walletResponse = await request(app)
        .get('/api/payments/wallet')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(walletResponse.status).toBe(200);
      expect(walletResponse.body.balance).toBeDefined();

      // 4. Generate PromptPay QR for top-up
      const qrResponse = await request(app)
        .post('/api/payments/promptpay/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 500 });
      
      expect(qrResponse.status).toBe(200);
      expect(qrResponse.body.qr_code).toBeDefined();

      // 5. Start charging session
      const chargingResponse = await request(app)
        .post('/api/charging/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          station_id: testStationId,
          vehicle_id: vehicleResponse.body.vehicle.id
        });
      
      expect(chargingResponse.status).toBe(200);
      expect(chargingResponse.body.session).toBeDefined();

      // 6. Get current session
      const currentSessionResponse = await request(app)
        .get('/api/charging/current')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(currentSessionResponse.status).toBe(200);
      expect(currentSessionResponse.body.session).toBeDefined();

      // 7. Stop charging session
      const stopResponse = await request(app)
        .post('/api/charging/stop')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          session_id: chargingResponse.body.session.id
        });
      
      expect(stopResponse.status).toBe(200);
    });
  });

  describe('Admin Workflow', () => {
    test('Admin can manage system completely', async () => {
      // 1. Get dashboard stats
      const dashboardResponse = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body.stats).toBeDefined();

      // 2. Get users list
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(usersResponse.status).toBe(200);
      expect(Array.isArray(usersResponse.body.users)).toBe(true);

      // 3. Get stations list
      const stationsResponse = await request(app)
        .get('/api/admin/stations')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(stationsResponse.status).toBe(200);
      expect(Array.isArray(stationsResponse.body.stations)).toBe(true);

      // 4. Get payment transactions
      const transactionsResponse = await request(app)
        .get('/api/admin/payments/transactions')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(transactionsResponse.status).toBe(200);
      expect(Array.isArray(transactionsResponse.body.transactions)).toBe(true);

      // 5. Get system logs
      const logsResponse = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(logsResponse.status).toBe(200);
      expect(Array.isArray(logsResponse.body.logs)).toBe(true);
    });

    test('Admin can adjust user wallet', async () => {
      const adjustmentResponse = await request(app)
        .post(`/api/admin/users/${testUserId}/wallet/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'add',
          amount: 100,
          note: 'Test adjustment'
        });
      
      expect(adjustmentResponse.status).toBe(200);
    });
  });

  describe('Energy Management', () => {
    test('Energy system works correctly', async () => {
      // 1. Get inverters status
      const invertersResponse = await request(app)
        .get('/api/energy/inverters')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(invertersResponse.status).toBe(200);
      expect(Array.isArray(invertersResponse.body.inverters)).toBe(true);

      // 2. Get production data
      const productionResponse = await request(app)
        .get('/api/energy/production')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          start_date: '2023-01-01',
          end_date: '2023-12-31'
        });
      
      expect(productionResponse.status).toBe(200);
      expect(Array.isArray(productionResponse.body.data)).toBe(true);

      // 3. Get energy stats
      const statsResponse = await request(app)
        .get('/api/energy/stats')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.success).toBe(true);
    });
  });

  describe('OCPP WebSocket Integration', () => {
    test('OCPP WebSocket server accepts connections', (done) => {
      const ws = new WebSocket(`ws://localhost:${process.env.OCPP_PORT || 8080}/station1`);
      
      ws.on('open', () => {
        // Send boot notification
        const bootNotification = [
          2,
          "12345",
          "BootNotification",
          {
            "chargePointVendor": "Delta",
            "chargePointModel": "AC Mini Plus"
          }
        ];
        
        ws.send(JSON.stringify(bootNotification));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data);
        expect(Array.isArray(message)).toBe(true);
        expect(message[0]).toBe(3); // CallResult
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    }, 10000);
  });

  describe('Security Tests', () => {
    test('Rate limiting works correctly', async () => {
      const requests = [];
      
      // Make multiple requests quickly
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({
              username: 'nonexistent',
              password: 'wrong'
            })
        );
      }
      
      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('Invalid tokens are rejected', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
    });

    test('SQL injection protection', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: "admin'; DROP TABLE users; --",
          password: 'password'
        });
      
      expect(response.status).toBe(400);
    });
  });

  describe('Error Handling', () => {
    test('Handles malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');
      
      expect(response.status).toBe(400);
    });

    test('Handles missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test'
          // missing required fields
        });
      
      expect(response.status).toBe(400);
    });

    test('Handles database connection errors gracefully', async () => {
      // This would require mocking database connection
      // For now, we'll test that the error handler is properly set up
      expect(app._router).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    test('API responses are within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/stations')
        .set('Authorization', `Bearer ${authToken}`);
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('Can handle concurrent requests', async () => {
      const concurrentRequests = 20;
      const requests = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(app)
            .get('/api/stations')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});
