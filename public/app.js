const $ = id => document.getElementById(id);
$('host').textContent = location.host + location.pathname;
const configured = window.NETWORK_TEST_CONFIG?.apiBase;
// A deployed direct page uses its own Worker; Pages must use an explicitly configured origin.
const directHost = location.hostname.endsWith('.workers.dev') || location.hostname === '127.0.0.1' || location.hostname === 'localhost';
const apiBase = configured || (directHost ? location.origin : null);
const messages = {test_budget_exhausted:'测试记录额度已用完（500 条）',rate_limited:'请求过于频繁，请稍后重试',database_unavailable:'数据库暂不可用',origin_not_allowed:'此页面来源尚未获准跨域访问',database_not_configured:'数据库尚未部署'};
async function request(path, options = {}) {
  const start = performance.now();
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(apiBase + path, {...options,signal:controller.signal,cache:'no-store',credentials:'omit',redirect:'error'});
    const data = await response.json();
    if (!response.ok) throw new Error('HTTP ' + response.status + ' · ' + (messages[data.error] || data.error || '请求失败'));
    return {data,ms:Math.round(performance.now()-start)};
  } finally { clearTimeout(timer); }
}
function fail(error) { return error.name === 'AbortError' ? '等待超过 15 秒，请换网对照或重试。' : error.message + '。若为 Failed to fetch，可能涉及网络或跨域限制，请比较直达入口。'; }
function install(buttonId, resultId, label, run) {
  const button = $(buttonId), result = $(resultId);
  button.disabled = false; button.textContent = label;
  button.addEventListener('click', async () => {
    button.disabled = true; result.dataset.state = 'pending'; result.textContent = '正在测试…'; const start = performance.now();
    try { await run(result); result.dataset.state = 'success'; }
    catch (error) { result.dataset.state = 'error'; result.textContent += '\n失败 · '+Math.round(performance.now()-start)+' 毫秒\n'+fail(error); }
    finally { button.disabled = false; button.textContent = '再测一次'; }
  });
}
if (!apiBase) {
  $('configuration').textContent = 'GitHub 前端已发布；Cloudflare 账户尚未授权，后端与数据库尚未上线。当前只能验证页面访问，不能宣称完整测试成功。';
  for (const id of ['ping','db']) $(id).textContent = '等待 Cloudflare 后端部署';
} else {
  const link = $('direct'); link.href = apiBase + '/'; link.hidden = false;
  $('configuration').textContent = '当前后端：'+apiBase+'。两入口请求同一个后端与数据库。';
  install('ping','ping-result','测试后端连接',async result => {
    const nonce = crypto.randomUUID(); const {data,ms} = await request('/api/ping?nonce='+nonce);
    if (data.ok !== true || data.nonce !== nonce || data.service !== 'classroom-network-test' || !Number.isFinite(Date.parse(data.serverTime))) throw new Error('后端返回内容不匹配');
    result.textContent = '后端连接成功 · '+ms+' 毫秒\n服务器时间：'+new Date(data.serverTime).toLocaleString('zh-CN');
  });
  install('db','db-result','测试数据库写入与读取',async result => {
    const id = crypto.randomUUID(), marker = crypto.randomUUID();
    const written = await request('/api/probes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,marker})});
    if (!written.data.ok || written.data.id !== id) throw new Error('写入响应不匹配');
    result.textContent = '写入成功 · '+written.ms+' 毫秒\n正在独立读取…';
    const read = await request('/api/probes/'+id);
    if (!read.data.ok || read.data.probe?.id !== id || read.data.probe?.marker !== marker) throw new Error('读回记录不匹配');
    result.textContent = '数据库写读成功\n写入：'+written.ms+' 毫秒；读取：'+read.ms+' 毫秒\n随机标识：'+id;
  });
}
