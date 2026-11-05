// 自动探测可用代理。优先级：
// 1. 环境变量 HTTPS_PROXY
// 2. 系统代理（注册表 ProxyEnable=1）
// 3. 端口探测（Clash/V2Ray 常见端口，即使没开系统代理也能用）
const { execSync } = require("child_process");
const net = require("net");

const CANDIDATE_PORTS = [7897, 7890, 7891, 10809, 10808, 1080, 8888, 8080];
let state = { proxy: null, source: "none", at: 0 };

function fromEnv() {
  return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || null;
}

function fromRegistry() {
  if (process.platform !== "win32") return null;
  try {
    const key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
    const enable = execSync(`reg query "${key}" /v ProxyEnable`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    if (!/0x1/.test(enable)) return null;
    const out = execSync(`reg query "${key}" /v ProxyServer`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const m = out.match(/ProxyServer\s+REG_SZ\s+(\S+)/);
    if (!m) return null;
    const p = m[1];
    return /^https?:\/\//.test(p) ? p : "http://" + p;
  } catch {
    return null;
  }
}

function probePort(port, timeout = 400) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, "127.0.0.1");
  });
}

async function fromPorts() {
  for (const port of CANDIDATE_PORTS) {
    if (await probePort(port)) return `http://127.0.0.1:${port}`;
  }
  return null;
}

async function detect(force = false) {
  if (!force && Date.now() - state.at < 60000) return state;

  let proxy = fromEnv(), source = "env";
  if (!proxy) {
    await new Promise(r => setTimeout(r, 0));
    const reg = fromRegistry();
    if (reg) { proxy = reg; source = "registry"; }
  }
  if (!proxy) {
    const p = await fromPorts();
    if (p) { proxy = p; source = "port"; }
  }

  if (!proxy) {
    state = { proxy: null, source: "none", at: Date.now() };
    console.log("[proxy] 未检测到可用代理，使用直连");
    return state;
  }

  try {
    const { ProxyAgent, setGlobalDispatcher } = require("undici");
    setGlobalDispatcher(new ProxyAgent(proxy));
    state = { proxy, source, at: Date.now() };
    console.log(`[proxy] 使用代理 ${proxy}（来源：${source}）`);
  } catch (e) {
    state = { proxy: null, source: "error", at: Date.now() };
    console.log("[proxy] 设置失败，直连：", e.message);
  }
  return state;
}

function setup() {
  // 同步返回上次状态，探测在后台完成（首次可能稍慢，抓取前会 await）
  const p = fromEnv() || (process.platform === "win32" ? fromRegistry() : null);
  if (p) {
    try {
      const { ProxyAgent, setGlobalDispatcher } = require("undici");
      setGlobalDispatcher(new ProxyAgent(p));
      state = { proxy: p, source: "sync", at: Date.now() };
      console.log("[proxy] 使用代理", p);
      return p;
    } catch (e) {
      console.log("[proxy] 设置失败，直连：", e.message);
    }
  }
  detect(true); // 异步探测端口
  return null;
}

function status() {
  return { proxy: state.proxy, source: state.source };
}

module.exports = { setup, detect, status };
