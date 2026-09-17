/**
 * Portfolio bar shared across kohjakob.com projects, fixed to the bottom of the viewport. Markup,
 * avatar and styles are copied verbatim from the recorder project's index.html
 * (footer.portfolio-bar); keep the two in sync. `.app` bottom padding keeps content clear of it.
 */
const AVATAR = 'data:image/webp;base64,UklGRiQEAABXRUJQVlA4IBgEAABwEwCdASpAAEAAPmEojkUkIqEYCwZ8QAYEoAuzPCzfF3DbQX7etbl+bv4xJRuG+uSLzltuWaZKal5f/kIpjwuaRTOvMK66rgT0ja8Nn5GGqvLtCZYx6ovk8xXurYFQH732TNf0M3e83/z7s/BXN1GZV61MZu6qwM1w7DZ5O53OY63qrBCFc2fVgZpwrzLXa4YzQwXW7JzYOAyZGY6JuCL/ZqdgAAD+/pOuqPckdsQ4mBw3taQYgw+tP6m7PbcUAKbvIDeBiS0LWossxqghfwLfY1zHHTNbokvRNOL+gWf+SMKnn84sK/WerA1S7Fy1sm6yZlMeokgpiX+s1BrnYeFALKWScZNaTqCNaQvA4bF0PrJkeyvcWY15/m+z5eWlZR+N+lHSPLSW+tH353/8B2OBJGlL/rjB0PZWU6l7rxHG+jYg7pQMkagKw9gcRo5Rre63HSj6kEMlrWm0UnV6kaZU+g7ry5j5pcvTkePrZNXsQc5c7FraAtaAIDo7DLxojlvwqnW+wX5/cWQAdO8YoI7ClxIIZ/NsNnEA1RZS9v7oJEDP0EZ9JNr0mKoJQImovT2Digpl04ARonbxMBrUxPLvbcjQkq9zKkZvpB9SDqaEpRkyTeaPqdmdFq2TF5HtwAd1lC/4RqtQj3OKV3M8ijr/pJKhvOYALPCIm/Spl4Cs0P88tO4M1RwFp/Wq/VnaLNU5cjsBpk06wK0NJ1cJThHi+2jImCCIP+6bSkUrt6aB1bU1EJuxkz4BoeEhl2c/Yoo+8tTH9oSazat4zRyBXter5JEvj6GIOBBgZ+AYIGTojrZ/2GvvVoFy1/tgagbAfc/KEQ08sRtqBrt+XpdGioJTDdHkkSEavF9GvDvbVsGoUDn4eWUkgVIi9c1y8Ao3fuQXz0F/StBObk7lNXM0DXnYZ74P1Q/tuSu634rLw2YQ7JvaX9vj0TEcVrH6rJ7dncWOLg7kVDOpdANa5MkW01ciBeYyb0pqINI4qx6hZrY0dj8EtlMbHMxv0QCvGxM1rKpW3a+IWFctHahuEFNZwKuwtJNlMvukCgyZUyK7O3M9p8A3w7Dx6zQNCiwHk9OQMli0p54Rc41csch5buE0Fk54hr20x/nhfD064evWf5YvftoLcYOPd0ANA1m3ee//k01FCix7Snb5Slse8iHQ5MCRHX9tmwW5Rw62PKbj8MKoV8Cb76RaLg8C/3fTwxPbHPd3YpHVhLNhrM7NdrTrWC9Egd/I+4titSuA9zT7Hsa4/+3H+JSUYSQjP80KlgUGvWb3+gFZPtG0YBtqAc63pu+zSP0ht7oRD446NZo+n+Uarj+gUjycSIXGOPyHRI0dBIN61x3vxbzL3KMid6RXRPnx9G2HRXLXadrwKk/2/ah4oa+YYOfQAAAA';

export function PortfolioBar() {
  return (
    <footer className="portfolio-bar">
      <div className="portfolio-bar-inner">
        <span className="portfolio-explore">
          <img className="portfolio-avatar" src={AVATAR} alt="Jakob Kohlhas" width={32} height={32} />
          <span>
            Explore other <a href="https://kohjakob.com/code/">code</a> and <a href="https://kohjakob.com/paintings/">paintings</a> at kohjakob.com
          </span>
        </span>
        <a className="portfolio-imprint" href="https://kohjakob.com/imprint/" target="_blank" rel="noopener">
          Imprint {'\u2197\uFE0E'}
        </a>
      </div>
    </footer>
  );
}
