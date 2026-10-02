using System.Collections.Concurrent;
using api.Services;

namespace api.Tests.Infrastructure;

/// <summary>Records SMS messages instead of sending them.</summary>
public class FakeSmsService : ISmsService
{
    public ConcurrentQueue<(string Phone, string Message)> Sent { get; } = new();

    public bool ShouldSucceed { get; set; } = true;

    public Task<SmsSendResult> SendSmsAsync(string phoneNumber, string message)
    {
        Sent.Enqueue((phoneNumber, message));
        return Task.FromResult(ShouldSucceed ? SmsSendResult.Ok() : SmsSendResult.Fail("fake failure"));
    }
}
