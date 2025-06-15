using Newtonsoft.Json;
using System.IO;
using System.Collections.Generic;
using System.Linq;

namespace BrastelPin
{
    partial class GUIDataModel
    {
        private const string GUI_DATA_FILE_PATH = "data";

        public string AccountCode { get; set; }
        public int PinFrom { get; set; }
        public int PinTo { get; set; }
        public string TMProxy { get; set; } // Multi-line text containing proxy keys
        public string OmniloginURL { get; set; }
        public string WorkflowID { get; set; }
        public int ConcurrentProfiles { get; set; } = 1;

        [JsonIgnore]
        public List<string> TMProxyKeys
        {
            get
            {
                if (string.IsNullOrEmpty(TMProxy))
                    return new List<string>();

                return TMProxy.Split('\n')
                    .Select(key => key.Trim())
                    .Where(key => !string.IsNullOrEmpty(key))
                    .ToList();
            }
        }

        public GUIDataModel()
        {
            AccountCode = string.Empty;
            PinFrom = 0;
            PinTo = 0;
            TMProxy = string.Empty;
            OmniloginURL = "localhost:35353/";
            WorkflowID = string.Empty;
        }

        public void SaveToFile()
        {
            string json = JsonConvert.SerializeObject(this, Formatting.Indented);
            File.WriteAllText(GUI_DATA_FILE_PATH, json);
        }

        public static GUIDataModel LoadFromFile()
        {
            if (!File.Exists(GUI_DATA_FILE_PATH))
            {
                return new GUIDataModel();
            }

            try
            {
                string json = File.ReadAllText(GUI_DATA_FILE_PATH);
                var model = JsonConvert.DeserializeObject<GUIDataModel>(json) ?? new GUIDataModel();

                return model;
            }
            catch
            {
                return new GUIDataModel();
            }
        }

        /// <summary>
        /// Validates that the number of concurrent profiles doesn't exceed the number of proxy keys
        /// </summary>
        public bool ValidateConcurrentProfiles(out string errorMessage)
        {
            var proxyKeys = TMProxyKeys;

            if (proxyKeys.Count == 0)
            {
                errorMessage = "No proxy keys provided. Please add at least one proxy key.";
                return false;
            }

            if (ConcurrentProfiles > proxyKeys.Count)
            {
                errorMessage = $"Number of concurrent profiles ({ConcurrentProfiles}) cannot be greater than the number of proxy keys ({proxyKeys.Count}).";
                return false;
            }

            if (ConcurrentProfiles <= 0)
            {
                errorMessage = "Number of concurrent profiles must be greater than 0.";
                return false;
            }

            errorMessage = string.Empty;
            return true;
        }
    }
}
