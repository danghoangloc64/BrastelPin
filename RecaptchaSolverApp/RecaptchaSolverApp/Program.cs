using System;
using System.Collections.Specialized;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Xml.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace BrastelLoginWith2Captcha
{
    class Program
    {
        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;

            // === 🔧 CHỈNH CÁC GIÁ TRỊ NÀY ===
            string apiKey = "17cd1a64108942703069ab7466224818";      // Thay bằng API key 2Captcha của bạn
            string accessCode = "25908535";                // AccessCode 7 chữ số
            string pin = "7676";                          // Mã PIN 4 chữ số
            string ip = "113.185.78.123";                   // IP hiện tại (hoặc để trống nếu không cần)
            // =================================

            string siteKey = "6LfSQJMaAAAAANkDlhNyCPNoOnj-kG63_3JM3HOn";
            string pageUrl = "https://www.brastel.com/WEB/WIMS/Manager.aspx";
            string action = "login_attempt";

            try
            {
                string token = SolveCaptcha(apiKey, siteKey, pageUrl, action);
                Console.WriteLine("\n✅ Token reCAPTCHA:");
                Console.WriteLine(token);

                Console.WriteLine("\n🔐 Gửi yêu cầu đăng nhập...");

                string result = await BrastelLogin.ValidateLogin(accessCode, pin, token, ip);

                Console.WriteLine("\n📦 Kết quả phản hồi từ Brastel:");
                Console.WriteLine(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine("❌ Lỗi: " + ex.Message);
            }

            Console.WriteLine("\nHoàn tất. Nhấn phím bất kỳ để thoát...");
            Console.ReadKey();
        }
        public static string SolveCaptcha(string apiKey, string googleKey, string pageUrl, string action)
        {
            string minScore = "0.9";
            string requestUrl = "http://2captcha.com/in.php";

            using (var client = new WebClient())
            {
                var values = new NameValueCollection
                {
                    ["key"] = apiKey,
                    ["method"] = "userrecaptcha",
                    ["googlekey"] = googleKey,
                    ["pageurl"] = pageUrl,
                    ["version"] = "v3",
                    ["action"] = action,
                    ["min_score"] = minScore
                };

                try
                {
                    var response = client.UploadValues(requestUrl, values);
                    string result = System.Text.Encoding.UTF8.GetString(response);

                    if (!result.StartsWith("OK|"))
                    {
                        Console.WriteLine("❌ Submit CAPTCHA failed: " + result);
                        return null;
                    }

                    string captchaId = result.Split('|')[1];
                    string resultUrl = $"http://2captcha.com/res.php?key={apiKey}&action=get&id={captchaId}";

                    for (int i = 0; i < 20; i++) // Wait up to ~100 seconds
                    {
                        Thread.Sleep(5000); // Wait 5 seconds

                        string tokenResponse = client.DownloadString(resultUrl);

                        if (tokenResponse.StartsWith("OK|"))
                        {
                            string captchaToken = tokenResponse.Split('|')[1];
                            Console.WriteLine("✅ CAPTCHA solved");
                            return captchaToken;
                        }
                        else if (tokenResponse != "CAPCHA_NOT_READY")
                        {
                            Console.WriteLine("❌ CAPTCHA error: " + tokenResponse);
                            return null;
                        }

                        Console.WriteLine("⌛ Waiting for CAPTCHA to be ready...");
                    }

                    Console.WriteLine("❌ CAPTCHA timeout.");
                    return null;
                }
                catch (Exception ex)
                {
                    Console.WriteLine("❌ Exception during CAPTCHA solving: " + ex.Message);
                    return null;
                }
            }
        }

        //static string SolveCaptcha(string apiKey, string googleKey, string pageUrl, string action)
        //{
        //    using (WebClient client = new WebClient())
        //    {
        //        NameValueCollection data = new NameValueCollection
        //        {
        //            { "key", apiKey },
        //            { "method", "userrecaptcha" },
        //            { "googlekey", googleKey },
        //            { "pageurl", pageUrl },
        //            { "version", "v3" },
        //            { "action", action },
        //            { "min_score", "0.3" }
        //        };

        //        Console.WriteLine("🧠 Gửi yêu cầu CAPTCHA tới 2Captcha...");
        //        string response = Encoding.UTF8.GetString(client.UploadValues("http://2captcha.com/in.php", data));

        //        if (!response.StartsWith("OK|"))
        //            throw new Exception("Không thể gửi CAPTCHA: " + response);

        //        string captchaId = response.Split('|')[1];

        //        // Poll kết quả
        //        for (int i = 0; i < 24; i++)
        //        {
        //            Thread.Sleep(5000);
        //            string result = client.DownloadString($"http://2captcha.com/res.php?key={apiKey}&action=get&id={captchaId}");

        //            if (result.StartsWith("OK|"))
        //                return result.Substring(3);

        //            if (result != "CAPCHA_NOT_READY")
        //                throw new Exception("Lỗi 2Captcha: " + result);

        //            Console.Write(".");
        //        }

        //        throw new Exception("Hết thời gian chờ phản hồi từ 2Captcha.");
        //    }
        //}
        public static BrastelLoginResponse ValidateLogin(string login, string pin, string ip, string recaptchaToken)
        {
            var data = new
            {
                login = login,
                password = pin,
                languageID = "4",
                serviceID = "1",
                style = "1",
                ip = ip,
                recaptchaToken = recaptchaToken,
                uniqueKey = ""
            };

            string jsonData = JsonConvert.SerializeObject(data);
            var request = (HttpWebRequest)WebRequest.Create("https://www.brastel.com/WEB/WIMS/ajaxpro/WIMS.LoginAjax,WIMS.ashx");

            request.Method = "POST";
            request.ContentType = "text/plain; charset=UTF-8";
            request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
            request.Headers.Add("X-AjaxPro-Method", "validate");
            request.Accept = "*/*";
            request.Host = "www.brastel.com"; // thường không cần set, hệ thống tự xử lý
            request.Headers.Add("sec-ch-ua", "\"Google Chrome\";v=\"137\", \"Chromium\";v=\"137\", \";Not=A-Brand\";v=\"99\"");
            request.Headers.Add("sec-ch-ua-platform", "\"Windows\"");
            request.Headers.Add("sec-ch-ua-mobile", "?0");
            request.Headers.Add("Sec-Fetch-Site", "same-origin");
            request.Headers.Add("Sec-Fetch-Mode", "cors");
            request.Headers.Add("Sec-Fetch-Dest", "empty");


            try
            {
                using (var streamWriter = new StreamWriter(request.GetRequestStream()))
                {
                    streamWriter.Write(jsonData);
                }

                using (var response = (HttpWebResponse)request.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream()))
                {
                    var result = reader.ReadToEnd();
                    return new BrastelLoginResponse
                    {
                        IsSuccess = true,
                        ResponseText = result
                    };
                }
            }
            catch (WebException ex)
            {
                using (var reader = new StreamReader(ex.Response.GetResponseStream()))
                {
                    string error = reader.ReadToEnd();
                    return new BrastelLoginResponse
                    {
                        IsSuccess = false,
                        ResponseText = error
                    };
                }
            }
        }


        //static string ValidateLogin(string accessCode, string pin, string token, string ip)
        //{
        //    string url = "https://www.brastel.com/WEB/WIMS/ajax/LoginAjax.aspx/WIMS.LoginAjax.validate";

        //    var payload = new
        //    {
        //        accessCode = accessCode,
        //        pin = pin,
        //        loginType = "4",
        //        accessType = "1",
        //        accessDevice = "1",
        //        ip = ip,
        //        captchaToken = token,
        //        customerId = ""
        //    };

        //    string jsonData = JsonConvert.SerializeObject(payload);

        //    using (WebClient client = new WebClient())
        //    {
        //        client.Headers.Add("X-AjaxPro-Method", "validate");
        //        client.Headers.Add("Content-Type", "text/plain; charset=UTF-8");
        //        client.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36");
        //        client.Headers.Add("Accept", "*/*");
        //        client.Headers.Add("Host", "www.brastel.com");
        //        client.Headers.Add("sec-ch-ua", "\"Google Chrome\";v=\"137\", \"Chromium\";v=\"137\", \";Not=A-Brand\";v=\"99\"");
        //        client.Headers.Add("sec-ch-ua-platform", "\"Windows\"");
        //        client.Headers.Add("sec-ch-ua-mobile", "?0");
        //        client.Headers.Add("Sec-Fetch-Site", "same-origin");
        //        client.Headers.Add("Sec-Fetch-Mode", "cors");
        //        client.Headers.Add("Sec-Fetch-Dest", "empty");

        //        string response = client.UploadString(url, "POST", jsonData);
        //        JObject json = JObject.Parse(response);
        //        return json["d"]?.ToString() ?? "Không có phản hồi";
        //    }
        //}

    }

    public class BrastelLoginResponse
    {
        public string ResponseText { get; set; }
        public bool IsSuccess { get; set; }
    }
}
