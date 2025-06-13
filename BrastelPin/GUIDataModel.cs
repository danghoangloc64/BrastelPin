using Newtonsoft.Json;
using System.IO;

namespace BrastelPin
{
    partial class GUIDataModel
    {
        private const string GUI_DATA_FILE_PATH = "data";

        public string AccountCode { get; set; }
        public int PinFrom { get; set; }
        public int PinTo { get; set; }
        public string TMProxy { get; set; }

        public GUIDataModel()
        {
            AccountCode = string.Empty;
            PinFrom = 0;
            PinTo = 0;
            TMProxy = string.Empty;
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
                return JsonConvert.DeserializeObject<GUIDataModel>(json) ?? new GUIDataModel();
            }
            catch
            {
                return new GUIDataModel();
            }
        }
    }
}
