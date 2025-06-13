namespace BrastelPin
{
    public class ProxyData
    {
        public string ip_allow { get; set; }
        public string isp_name { get; set; }
        public string location_name { get; set; }
        public string socks5 { get; set; }
        public string https { get; set; }
        public int timeout { get; set; }
        public int next_request { get; set; }
        public string expired_at { get; set; }
        public string username { get; set; }
        public string password { get; set; }
        public string public_ip { get; set; }
    }

    public class ProxyResponse
    {
        public int code { get; set; }
        public string message { get; set; }
        public ProxyData data { get; set; }
    }

}
