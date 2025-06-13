using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;

namespace BrastelPin
{
    public class OmniLoginProfileManager
    {
        private readonly string baseUrl;
        private readonly string startUrl;
        private readonly string stopUrl;
        private readonly HttpClient client;

        public OmniLoginProfileManager(string baseAddress)
        {
            baseUrl = $"{baseAddress}/api/v1/profile";
            startUrl = $"{baseAddress}/api/v1/browser/start";
            stopUrl = baseUrl.TrimEnd('/') + "/api/v1/browser/stop";
            client = new HttpClient();
        }

        // 0. Delete all existing profiles
        public async Task DeleteAllProfilesAsync()
        {
            try
            {
                var profileIds = await GetAllProfileIdsAsync();
                foreach (var id in profileIds)
                {
                    await DeleteProfileAsync(id);
                    await Task.Delay(100);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Error] Failed to delete all profiles: {ex.Message}");
            }
        }

        private async Task<List<string>> GetAllProfileIdsAsync()
        {
            var ids = new List<string>();
            try
            {
                var response = await client.GetAsync($"{baseUrl}/list");
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                var data = JObject.Parse(json)["data"];

                foreach (var item in data)
                {
                    var id = item["id"]?.ToString();
                    if (!string.IsNullOrEmpty(id)) ids.Add(id);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Error] Failed to get profile IDs: {ex.Message}");
            }

            return ids;
        }

        public async Task DeleteProfileAsync(string id)
        {
            try
            {
                var content = new StringContent($"{{\"profileId\":\"{id}\"}}", Encoding.UTF8, "application/json");
                var response = await client.PostAsync($"{baseUrl}/delete", content);
                response.EnsureSuccessStatusCode();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Error] Failed to delete profile {id}: {ex.Message}");
            }
        }

        // 1. Create new profile
        public async Task<string> CreateProfileAsync(string name = "MyProfile")
        {
            try
            {
                var json = new JObject
                {
                    ["name"] = name,
                    ["browserType"] = "mimic",
                    ["os"] = "win",
                    ["navigator"] = new JObject
                    {
                        ["language"] = "en-US",
                        ["userAgent"] = "Mozilla/5.0"
                    }
                };

                var content = new StringContent(json.ToString(), Encoding.UTF8, "application/json");
                var response = await client.PostAsync($"{baseUrl}/create", content);
                response.EnsureSuccessStatusCode();

                var responseBody = await response.Content.ReadAsStringAsync();
                var profileId = JObject.Parse(responseBody)["data"]?["id"]?.ToString();

                if (string.IsNullOrEmpty(profileId))
                    throw new Exception("Profile ID is null or empty");

                return profileId;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Error] Failed to create profile: {ex.Message}");
                throw; // propagate error
            }
        }

        // 2. Start profile and return remote debugging port
        public async Task<int> StartProfileAsync(string profileId)
        {
            try
            {
                var content = new StringContent($"{{\"profileId\":\"{profileId}\"}}", Encoding.UTF8, "application/json");
                var response = await client.PostAsync(startUrl, content);
                response.EnsureSuccessStatusCode();

                var responseBody = await response.Content.ReadAsStringAsync();
                var port = JObject.Parse(responseBody)["data"]?["port"]?.ToObject<int>() ?? 0;

                if (port == 0)
                    throw new Exception("Received invalid port from OmniLogin");

                return port;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Error] Failed to start profile: {ex.Message}");
                throw;
            }
        }

        // 3. Get ChromeDriver from port (external control)
        public ChromeDriver GetChromeDriverFromPort(int port)
        {
            try
            {
                var options = new ChromeOptions
                {
                    DebuggerAddress = $"localhost:{port}"
                };
                return new ChromeDriver(options);
            }
            catch (WebDriverException ex)
            {
                Console.WriteLine($"[Error] ChromeDriver connection failed: {ex.Message}");
                throw;
            }
        }

        // New: Stop profile
        public async Task StopProfileAsync(string profileId)
        {
            var content = new StringContent($"{{\"profileId\":\"{profileId}\"}}", Encoding.UTF8, "application/json");
            await client.PostAsync(stopUrl, content);
        }
    }
}
