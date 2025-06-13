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
    public class OmniLoginProfileManager : IDisposable
    {
        // Constants
        private const int DEFAULT_TIMEOUT_SECONDS = 30;
        private const int PROFILE_CLEANUP_DELAY_MS = 100;
        private const int MAX_RETRY_ATTEMPTS = 3;

        private readonly string baseAddress; // e.g., "http://localhost:35353"
        private readonly HttpClient client;
        private readonly Action<string> logAction;
        private bool disposed = false;

        public OmniLoginProfileManager(string baseAddress, Action<string> logAction = null)
        {
            this.baseAddress = baseAddress?.TrimEnd('/') ?? throw new ArgumentNullException(nameof(baseAddress));
            this.logAction = logAction ?? ((msg) => Debug.WriteLine(msg));

            this.client = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(DEFAULT_TIMEOUT_SECONDS)
            };

            // Set default headers
            this.client.DefaultRequestHeaders.Add("User-Agent", "BrastelPin/1.0");

            LogInfo($"OmniLoginProfileManager initialized with base address: {baseAddress}");
        }

        #region Profile Management

        /// <summary>
        /// Creates a new profile in OmniLogin with optional proxy configuration
        /// </summary>
        /// <param name="name">Profile name (optional)</param>
        /// <param name="group">Profile group (optional)</param>
        /// <param name="operatingSystem">Operating system (optional, defaults to "win")</param>
        /// <param name="proxyResponse">Proxy configuration to embed in profile (optional)</param>
        /// <returns>Profile ID if successful, null otherwise</returns>
        public async Task<string> CreateProfileAsync(string name = null, string group = null, string operatingSystem = "win", ProxyResponse proxyResponse = null)
        {
            try
            {
                LogInfo($"Creating profile with name: {name ?? "default"}");

                var createUrl = $"{baseAddress}/api/v1/profile";
                var profileData = new JObject
                {
                    ["name"] = string.IsNullOrEmpty(name) ? $"Profile_{DateTime.Now:yyyyMMdd_HHmmss}" : name
                };

                // Add optional parameters
                if (!string.IsNullOrEmpty(group))
                    profileData["group"] = group;

                if (!string.IsNullOrEmpty(operatingSystem))
                    profileData["os"] = operatingSystem;

                // Add embedded proxy configuration if provided
                if (proxyResponse?.data != null)
                {
                    var embeddedProxy = new JObject
                    {
                        ["name"] = $"Proxy_{DateTime.Now:yyyyMMdd_HHmmss}",
                        ["proxy_type"] = "HTTP", // TMProxy typically uses HTTP
                        ["host"] = ExtractProxyHost(proxyResponse.data.https),
                        ["port"] = ExtractProxyPort(proxyResponse.data.https),
                        ["user_name"] = proxyResponse.data.username ?? "",
                        ["password"] = proxyResponse.data.password ?? ""
                    };
                    
                    profileData["embedded_proxy"] = embeddedProxy;
                    LogInfo($"Embedded proxy configured: {proxyResponse.data.https}");
                }

                var content = new StringContent(profileData.ToString(), Encoding.UTF8, "application/json");

                using (var response = await client.PostAsync(createUrl, content))
                {
                    var responseBody = await response.Content.ReadAsStringAsync();

                    if (!response.IsSuccessStatusCode)
                    {
                        LogError($"Failed to create profile. Status: {response.StatusCode}, Response: {responseBody}");
                        return null;
                    }

                    var responseJson = JObject.Parse(responseBody);
                    var profileId = responseJson["data"]?["id"]?.ToString();

                    if (string.IsNullOrEmpty(profileId))
                    {
                        LogError("Profile ID is null or empty after creation");
                        return null;
                    }

                    LogInfo($"Successfully created profile '{name}' with ID: {profileId}");
                    return profileId;
                }
            }
            catch (HttpRequestException ex)
            {
                LogError($"HTTP error while creating profile: {ex.Message}");
                return null;
            }
            catch (TaskCanceledException ex)
            {
                LogError($"Timeout while creating profile: {ex.Message}");
                return null;
            }
            catch (Exception ex)
            {
                LogError($"Unexpected error while creating profile: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Starts a profile and returns the remote debugging port
        /// </summary>
        /// <param name="profileId">Profile ID to start</param>
        /// <returns>Port number if successful, 0 otherwise</returns>
        public async Task<int> StartProfileAndGetPortAsync(string profileId)
        {
            if (string.IsNullOrEmpty(profileId))
            {
                LogError("Profile ID cannot be null or empty");
                return 0;
            }

            try
            {
                LogInfo($"Starting profile: {profileId}");

                var startUrl = $"{baseAddress}/api/v1/browser/start";
                var startData = new JObject
                {
                    ["profileId"] = profileId
                };

                var content = new StringContent(startData.ToString(), Encoding.UTF8, "application/json");

                using (var response = await client.PostAsync(startUrl, content))
                {
                    var responseBody = await response.Content.ReadAsStringAsync();

                    if (!response.IsSuccessStatusCode)
                    {
                        LogError($"Failed to start profile {profileId}. Status: {response.StatusCode}, Response: {responseBody}");
                        return 0;
                    }

                    var responseJson = JObject.Parse(responseBody);
                    var port = responseJson["data"]?["port"]?.ToObject<int>() ?? 0;

                    if (port == 0)
                    {
                        LogError($"Received invalid port from OmniLogin for profile {profileId}");
                        return 0;
                    }

                    LogInfo($"Successfully started profile {profileId} on port {port}");
                    return port;
                }
            }
            catch (HttpRequestException ex)
            {
                LogError($"HTTP error while starting profile {profileId}: {ex.Message}");
                return 0;
            }
            catch (TaskCanceledException ex)
            {
                LogError($"Timeout while starting profile {profileId}: {ex.Message}");
                return 0;
            }
            catch (Exception ex)
            {
                LogError($"Unexpected error while starting profile {profileId}: {ex.Message}");
                return 0;
            }
        }

        /// <summary>
        /// Creates a Chrome driver instance connected to the specified port
        /// </summary>
        /// <param name="port">Remote debugging port</param>
        /// <param name="implicitWaitSeconds">Implicit wait timeout in seconds</param>
        /// <returns>ChromeDriver instance</returns>
        public ChromeDriver GetChromeDriverFromPort(int port, int implicitWaitSeconds = 10)
        {
            if (port <= 0)
            {
                LogError($"Invalid port number: {port}");
                throw new ArgumentException("Port must be greater than 0", nameof(port));
            }

            try
            {
                LogInfo($"Creating ChromeDriver for port {port}");

                var options = new ChromeOptions();
                options.DebuggerAddress = $"localhost:{port}";

                // Additional Chrome options for stability
                options.AddArgument("--no-sandbox");
                options.AddArgument("--disable-dev-shm-usage");
                options.AddArgument("--disable-gpu");
                options.AddArgument("--disable-extensions");
                options.AddArgument("--disable-default-apps");

                var driver = new ChromeDriver(options);

                // Set implicit wait
                driver.Manage().Timeouts().ImplicitWait = TimeSpan.FromSeconds(implicitWaitSeconds);

                LogInfo($"Successfully created ChromeDriver for port {port}");
                return driver;
            }
            catch (WebDriverException ex)
            {
                LogError($"WebDriver error connecting to port {port}: {ex.Message}");
                throw;
            }
            catch (Exception ex)
            {
                LogError($"Unexpected error creating ChromeDriver for port {port}: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Stops a running profile
        /// </summary>
        /// <param name="profileId">Profile ID to stop</param>
        public async Task<bool> StopProfileAsync(string profileId)
        {
            if (string.IsNullOrEmpty(profileId))
            {
                LogError("Profile ID cannot be null or empty");
                return false;
            }

            try
            {
                LogInfo($"Stopping profile: {profileId}");

                // Try the browser-specific stop endpoint first
                var stopUrl = $"{baseAddress}/api/v1/browser/stop";
                var stopData = new JObject
                {
                    ["profileId"] = profileId
                };

                var content = new StringContent(stopData.ToString(), Encoding.UTF8, "application/json");
                using (var response = await client.PostAsync(stopUrl, content))
                {
                    if (response.IsSuccessStatusCode)
                    {
                        LogInfo($"Successfully stopped profile {profileId} using browser API");
                        return true;
                    }
                }

                // Fallback to the legacy endpoint
                var legacyStopUrl = $"{baseAddress}/stop/{profileId}";
                using (var response = await client.GetAsync(legacyStopUrl))
                {
                    if (response.IsSuccessStatusCode)
                    {
                        LogInfo($"Successfully stopped profile {profileId} using legacy API");
                        return true;
                    }
                    else
                    {
                        var error = await response.Content.ReadAsStringAsync();
                        LogError($"Failed to stop profile {profileId}. Status: {response.StatusCode}, Response: {error}");
                        return false;
                    }
                }
            }
            catch (HttpRequestException ex)
            {
                LogError($"HTTP error while stopping profile {profileId}: {ex.Message}");
                return false;
            }
            catch (TaskCanceledException ex)
            {
                LogError($"Timeout while stopping profile {profileId}: {ex.Message}");
                return false;
            }
            catch (Exception ex)
            {
                LogError($"Unexpected error while stopping profile {profileId}: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Deletes a profile
        /// </summary>
        /// <param name="profileId">Profile ID to delete</param>
        public async Task<bool> DeleteProfileAsync(string profileId)
        {
            if (string.IsNullOrEmpty(profileId))
            {
                LogError("Profile ID cannot be null or empty");
                return false;
            }

            try
            {
                LogInfo($"Deleting profile: {profileId}");

                var deleteUrl = $"{baseAddress}/api/v1/profile/{profileId}";

                using (var response = await client.DeleteAsync(deleteUrl))
                {
                    if (response.IsSuccessStatusCode)
                    {
                        LogInfo($"Successfully deleted profile {profileId}");
                        return true;
                    }
                    else
                    {
                        var error = await response.Content.ReadAsStringAsync();
                        LogError($"Failed to delete profile {profileId}. Status: {response.StatusCode}, Response: {error}");
                        return false;
                    }
                }
            }
            catch (HttpRequestException ex)
            {
                LogError($"HTTP error while deleting profile {profileId}: {ex.Message}");
                return false;
            }
            catch (TaskCanceledException ex)
            {
                LogError($"Timeout while deleting profile {profileId}: {ex.Message}");
                return false;
            }
            catch (Exception ex)
            {
                LogError($"Unexpected error while deleting profile {profileId}: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Deletes all existing profiles with retry mechanism
        /// </summary>
        public async Task<bool> DeleteAllProfilesAsync()
        {
            try
            {
                LogInfo("Starting bulk deletion of all profiles");

                var profileIds = await GetAllProfileIdsAsync();
                if (profileIds.Count == 0)
                {
                    LogInfo("No profiles found to delete");
                    return true;
                }

                LogInfo($"Found {profileIds.Count} profiles to delete");

                int successCount = 0;
                int failCount = 0;

                foreach (var profileId in profileIds)
                {
                    // Stop profile first, then delete
                    bool stopped = await StopProfileAsync(profileId);
                    if (stopped)
                    {
                        await Task.Delay(PROFILE_CLEANUP_DELAY_MS); // Small delay between operations
                    }

                    bool deleted = await DeleteProfileAsync(profileId);
                    if (deleted)
                    {
                        successCount++;
                    }
                    else
                    {
                        failCount++;
                    }

                    await Task.Delay(PROFILE_CLEANUP_DELAY_MS); // Small delay to avoid overwhelming the API
                }

                LogInfo($"Profile deletion completed. Success: {successCount}, Failed: {failCount}");
                return failCount == 0;
            }
            catch (Exception ex)
            {
                LogError($"Failed to delete all profiles: {ex.Message}");
                return false;
            }
        }

        #endregion

        #region Helper Methods

        /// <summary>
        /// Gets all profile IDs from the OmniLogin API
        /// </summary>
        private async Task<List<string>> GetAllProfileIdsAsync()
        {
            var ids = new List<string>();

            try
            {
                LogInfo("Retrieving all profile IDs");

                var listUrl = $"{baseAddress}/api/v1/profile";

                using (var response = await client.GetAsync(listUrl))
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        LogError($"Failed to get profile list. Status: {response.StatusCode}");
                        return ids;
                    }

                    var responseBody = await response.Content.ReadAsStringAsync();
                    var responseJson = JObject.Parse(responseBody);
                    var profiles = responseJson["data"];

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

                    LogInfo($"Retrieved {ids.Count} profile IDs");
                }
            }
            catch (HttpRequestException ex)
            {
                LogError($"HTTP error while getting profile IDs: {ex.Message}");
            }
            catch (TaskCanceledException ex)
            {
                LogError($"Timeout while getting profile IDs: {ex.Message}");
            }
            catch (Exception ex)
            {
                LogError($"Unexpected error while getting profile IDs: {ex.Message}");
            }

            return ids;
        }

        /// <summary>
        /// Checks if the OmniLogin service is reachable
        /// </summary>
        public async Task<bool> IsServiceAvailableAsync()
        {
            try
            {
                LogInfo("Checking OmniLogin service availability");

                var healthCheckUrl = $"{baseAddress}/api/v1/profile";

                using (var response = await client.GetAsync(healthCheckUrl))
                {
                    bool isAvailable = response.IsSuccessStatusCode;
                    LogInfo($"OmniLogin service availability: {isAvailable}");
                    return isAvailable;
                }
            }
            catch (Exception ex)
            {
                LogError($"OmniLogin service is not available: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Gets profile information by ID
        /// </summary>
        public async Task<JObject> GetProfileInfoAsync(string profileId)
        {
            if (string.IsNullOrEmpty(profileId))
            {
                LogError("Profile ID cannot be null or empty");
                return null;
            }

            try
            {
                LogInfo($"Getting profile info for: {profileId}");

                var infoUrl = $"{baseAddress}/api/v1/profile/{profileId}";

                using (var response = await client.GetAsync(infoUrl))
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        LogError($"Failed to get profile info for {profileId}. Status: {response.StatusCode}");
                        return null;
                    }

                    var responseBody = await response.Content.ReadAsStringAsync();
                    return JObject.Parse(responseBody);
                }
            }
            catch (Exception ex)
            {
                LogError($"Error getting profile info for {profileId}: {ex.Message}");
                return null;
            }
        }

        #endregion

        #region Logging

        private void LogInfo(string message)
        {
            logAction?.Invoke($"[INFO] {message}");
        }

        private void LogError(string message)
        {
            logAction?.Invoke($"[ERROR] {message}");
        }

        /// <summary>
        /// Extracts host from proxy string (format: host:port)
        /// </summary>
        private string ExtractProxyHost(string proxyString)
        {
            if (string.IsNullOrEmpty(proxyString))
                return "";

            var parts = proxyString.Split(':');
            return parts.Length > 0 ? parts[0] : "";
        }

        /// <summary>
        /// Extracts port from proxy string (format: host:port)
        /// </summary>
        private int ExtractProxyPort(string proxyString)
        {
            if (string.IsNullOrEmpty(proxyString))
                return 0;

            var parts = proxyString.Split(':');
            if (parts.Length > 1 && int.TryParse(parts[1], out int port))
                return port;

            return 0;
        }

        #endregion

        #region IDisposable Implementation

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (!disposed)
            {
                if (disposing)
                {
                    LogInfo("Disposing OmniLoginProfileManager");
                    client?.Dispose();
                }

                disposed = true;
            }
        }

        ~OmniLoginProfileManager()
        {
            Dispose(false);
        }

        #endregion
    }
}