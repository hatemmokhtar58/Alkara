using api.Services;

namespace api.Tests.Infrastructure;

/// <summary>A clock tests can move forward. Starts at the real Saudi time.</summary>
public class FakeClock : IClock
{
    public DateTime Now { get; set; } = new SaudiClock().Now;

    public void Advance(TimeSpan by) => Now = Now.Add(by);
}
