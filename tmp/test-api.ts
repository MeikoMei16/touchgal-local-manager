
import axios from 'axios';

const TOUCHGAL_API_BASE = 'https://touchgal.top';

async function testApi() {
  console.log('Testing TouchGal API...');
  try {
    const response = await axios.get(`${TOUCHGAL_API_BASE}/api/galgames`, {
      params: { page: 1, limit: 20 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://touchgal.top',
        'Referer': 'https://touchgal.top/'
      }
    });
    console.log('Status Code:', response.status);
    console.log('Response Status Field:', response.data?.status);
    console.log('Items Count:', response.data?.data?.length);
    console.log('First Item Snippet:', JSON.stringify(response.data?.data?.[0], null, 2));
  } catch (error) {
    console.error('API Test Failed:', error.message);
    if (error.response) {
      console.error('Data:', error.response.data);
    }
  }
}

testApi();
