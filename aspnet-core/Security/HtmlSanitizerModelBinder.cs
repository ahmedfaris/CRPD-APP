using Microsoft.AspNetCore.Mvc.ModelBinding;
using System.Threading.Tasks;
using Ganss.Xss;
using System;

namespace TicketManagementSystem.Security
{
    public class HtmlSanitizerModelBinder : IModelBinder
    {
        public Task BindModelAsync(ModelBindingContext bindingContext)
        {
            if (bindingContext == null)
            {
                throw new ArgumentNullException(nameof(bindingContext));
            }

            var valueProviderResult = bindingContext.ValueProvider.GetValue(bindingContext.ModelName);

            if (valueProviderResult == ValueProviderResult.None)
            {
                return Task.CompletedTask;
            }

            bindingContext.ModelState.SetModelValue(bindingContext.ModelName, valueProviderResult);
            var valueAsString = valueProviderResult.FirstValue;

            if (string.IsNullOrEmpty(valueAsString))
            {
                return Task.CompletedTask;
            }

            // Sanitize HTML
            var sanitizer = new HtmlSanitizer();
            var sanitizedValue = sanitizer.Sanitize(valueAsString);

            bindingContext.Result = ModelBindingResult.Success(sanitizedValue);
            return Task.CompletedTask;
        }
    }
}
