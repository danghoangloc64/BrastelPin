using System;
using System.Collections.Generic;
using System.Diagnostics;
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
        private readonly string baseAddress; // e.g., "http://localhost:35353"
        private readonly HttpClient client;

        public OmniLoginProfileManager(string baseAddress)
        {
            this.baseAddress = baseAddress.TrimEnd('/');
            this.client = new HttpClient();
        }

        // 1. Create new profile
        public async Task<string> CreateProfileAsync(string name = "MyProfile")
        {
            try
            {
                // CORRECTED: Use standard POST request to the main profile endpoint
                var createUrl = $"{baseAddress}/api/v1/profile";
                var json = new JObject
                {
                    ["name"] = name,
                    // You can add other parameters as needed
                    // ["group"] = "Default", 
                    // ["os"] = "win"
                };

                var content = new StringContent(json.ToString(), Encoding.UTF8, "application/json");
                var response = await client.PostAsync(createUrl, content);
                response.EnsureSuccessStatusCode();

                var responseBody = await response.Content.ReadAsStringAsync();
                var profileId = JObject.Parse(responseBody)["data"]?["id"]?.ToString();

                if (string.IsNullOrEmpty(profileId))
                    throw new Exception("Profile ID is null or empty after creation.");

                Debug.WriteLine($"[Info] Successfully created profile '{name}' with ID: {profileId}");
                return profileId;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Error] Failed to create profile: {ex.Message}");
                return null;
            }
        }

        // 2. Start profile and return remote debugging port
        public async Task<int> StartProfileAndGetPortAsync(string profileId)
        {
            try
            {
                // This endpoint seems correct for starting the browser for automation
                var startUrl = $"{baseAddress}/api/v1/browser/start";
                var content = new StringContent($"{{\"profileId\":\"{profileId}\"}}", Encoding.UTF8, "application/json");
                var response = await client.PostAsync(startUrl, content);
                response.EnsureSuccessStatusCode();

                var responseBody = await response.Content.ReadAsStringAsync();
                var port = JObject.Parse(responseBody)["data"]?["port"]?.ToObject<int>() ?? 0;

                if (port == 0)
                    throw new Exception("Received invalid port from OmniLogin");

                Debug.WriteLine($"[Info] Started profile {profileId} on port {port}");
                return port;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Error] Failed to start profile {profileId}: {ex.Message}");
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
                Debug.WriteLine($"[Error] ChromeDriver connection failed: {ex.Message}");
                throw;
            }
        }

        // 4. Stop profile
        public async Task StopProfileAsync(string profileId)
        {
            try
            {
                // CORRECTED: Use GET method and the /stop/{profileId} endpoint as per docs
                var stopUrl = $"{baseAddress}/stop/{profileId}";
                var response = await client.GetAsync(stopUrl); // Use GET, no content body

                if (response.IsSuccessStatusCode)
                {
                    Debug.WriteLine($"[Info] Successfully sent stop request for profile {profileId}");
                }
                else
                {
                    var error = await response.Content.ReadAsStringAsync();
                    Debug.WriteLine($"[Error] Failed to stop profile {profileId}. Status: {response.StatusCode}, Response: {error}");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Error] Exception while stopping profile {profileId}: {ex.Message}");
            }
        }

        // 5. Delete a single profile
        public async Task DeleteProfileAsync(string profileId)
        {
            try
            {
                // CORRECTED: Use DELETE method on the specific profile resource URL
                var deleteUrl = $"{baseAddress}/api/v1/profile/{profileId}";
                var response = await client.DeleteAsync(deleteUrl);

                if (response.IsSuccessStatusCode)
                {
                    Debug.WriteLine($"[Info] Successfully deleted profile {profileId}");
                }
                else
                {
                    var error = await response.Content.ReadAsStringAsync();
                    Debug.WriteLine($"[Error] Failed to delete profile {profileId}. Status: {response.StatusCode}, Response: {error}");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Error] Exception while deleting profile {profileId}: {ex.Message}");
            }
        }

        // 6. Delete all existing profiles
        public async Task<bool> DeleteAllProfilesAsync()
        {
            try
            {
                var profileIds = await GetAllProfileIdsAsync();
                Debug.WriteLine($"[Info] Found {profileIds.Count} profiles to delete.");
                foreach (var id in profileIds)
                {
                    await DeleteProfileAsync(id);
                    await Task.Delay(100); // Small delay to avoid overwhelming the API
                }
                Debug.WriteLine($"[Info] Finished deleting profiles.");
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Error] Failed to delete all profiles: {ex.Message}");
            }
            return false;
        }

        // Helper method to get all profile IDs
        private async Task<List<string>> GetAllProfileIdsAsync()
        {
            var ids = new List<string>();
            try
            {
                // CORRECTED: Use the main profile endpoint to get a list
                var listUrl = $"{baseAddress}/api/v1/profile";
                var response = await client.GetAsync(listUrl);
                response.EnsureSuccessStatusCode();

                var responseBody = await response.Content.ReadAsStringAsync();
                // Assuming the response is a JSON object with a "data" array of profiles
                var profiles = JObject.Parse(responseBody)["data"];

                if (profiles != null && profiles.Type == JTokenType.Array)
                {
                    foreach (var profile in profiles)
                    {
                        var id = profile["id"]?.ToString();
                        if (!string.IsNullOrEmpty(id))
                        {
                            ids.Add(id);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Error] Failed to get all profile IDs: {ex.Message}");
            }
            return ids;
        }
    }
}