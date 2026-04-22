using System;
using MySqlConnector;

namespace AlkaraScratch
{
    class Program
    {
        static void Main(string[] args)
        {
            string connString = "server=localhost;user=root;password=;";
            try
            {
                using (var conn = new MySqlConnection(connString))
                {
                    conn.Open();
                    using (var cmd = new MySqlCommand("SHOW DATABASES;", conn))
                    {
                        using (var reader = cmd.ExecuteReader())
                        {
                            Console.WriteLine("Available Databases:");
                            while (reader.Read())
                            {
                                Console.WriteLine("- " + reader.GetString(0));
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error: " + ex.Message);
            }
        }
    }
}
