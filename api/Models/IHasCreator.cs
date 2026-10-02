namespace api.Models
{
    /// <summary>Records that remember which user created them; filled in automatically on save.</summary>
    public interface IHasCreator
    {
        int? CreatedByUserId { get; set; }
    }
}
