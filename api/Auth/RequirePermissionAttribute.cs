using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace api.Auth
{
    /// <summary>
    /// Allows the request when the user is an Admin or has at least one of the listed permissions.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
    public class RequirePermissionAttribute : Attribute, IAuthorizationFilter
    {
        private readonly string[] _permissions;

        public RequirePermissionAttribute(params string[] permissions)
        {
            _permissions = permissions;
        }

        public void OnAuthorization(AuthorizationFilterContext context)
        {
            if (context.Filters.OfType<RequirePermissionAttribute>().LastOrDefault() != this)
            {
                return; // a more specific attribute on the action decides
            }

            var user = CurrentUser.Get(context.HttpContext);
            if (user == null)
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            if (!CurrentUser.HasAny(user, _permissions))
            {
                context.Result = new ObjectResult(new { message = "ليس لديك صلاحية للقيام بهذا الإجراء." }) { StatusCode = StatusCodes.Status403Forbidden };
            }
        }
    }

    /// <summary>Only users with the Admin role.</summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
    public class RequireAdminAttribute : RequirePermissionAttribute
    {
        public RequireAdminAttribute() : base() { }
    }
}
