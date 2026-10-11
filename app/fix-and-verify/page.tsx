import {redirect} from 'next/navigation';

// The original Fix & Verify copy was not the DSG Spacetime product proposition.
// Preserve existing links while directing visitors to the verified product scope.
export default function DeprecatedFixAndVerifyPage() {
  redirect('/remote-browser-execution');
}
