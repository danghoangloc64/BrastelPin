using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;

public class BrastelLogin
{
    private static readonly string loginUrl = "https://www.brastel.com/WEB/WIMS/ajaxpro/WIMS.LoginAjax,WIMS.ashx";

    public static async Task<string> ValidateLogin(string login, string password, string recaptchaToken, string ip = "113.185.80.8")
    {
        // Tạo HttpClientHandler có hỗ trợ cookie
        var handler = new HttpClientHandler
        {
            UseCookies = true,
            CookieContainer = new CookieContainer(),
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
        };

        using (var client = new HttpClient(handler))
        {
            // Gửi GET để lấy cookie ban đầu
            var preReq = await client.GetAsync("https://www.brastel.com/WEB/WIMS/");
            if (!preReq.IsSuccessStatusCode)
                throw new Exception("Không lấy được cookie ban đầu");

            // Set headers
            client.DefaultRequestHeaders.Clear();
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36");
            client.DefaultRequestHeaders.Accept.ParseAdd("*/*");
            client.DefaultRequestHeaders.Add("X-AjaxPro-Method", "validate");
            client.DefaultRequestHeaders.Referrer = new Uri("https://www.brastel.com/WEB/WIMS/");
            client.DefaultRequestHeaders.Add("Origin", "https://www.brastel.com");
            client.DefaultRequestHeaders.Add("Sec-Fetch-Site", "same-origin");
            client.DefaultRequestHeaders.Add("Sec-Fetch-Mode", "cors");
            client.DefaultRequestHeaders.Add("Sec-Fetch-Dest", "empty");
            client.DefaultRequestHeaders.Add("sec-ch-ua", "\"Google Chrome\";v=\"137\", \"Chromium\";v=\"137\", \";Not=A-Brand\";v=\"99\"");
            client.DefaultRequestHeaders.Add("sec-ch-ua-platform", "\"Windows\"");
            client.DefaultRequestHeaders.Add("sec-ch-ua-mobile", "?0");

            // Tạo nội dung JSON kiểu "text/plain"
            var jsonBody = $@"{{""login"":""{login}"",""password"":""{password}"",""languageID"":""4"",""serviceID"":""1"",""style"":""1"",""ip"":""{ip}"",""recaptchaToken"":""{recaptchaToken}"",""uniqueKey"":""""}}";

            var content = new StringContent(jsonBody, Encoding.UTF8, "text/plain");

            // Gửi POST request
            var response = await client.PostAsync(loginUrl, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"Lỗi HTTP {(int)response.StatusCode}: {responseContent}");

            return responseContent;
        }
    }
}
