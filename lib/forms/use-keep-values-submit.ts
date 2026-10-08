"use client";

import { startTransition, useCallback, type FormEvent } from "react";

// React 19 resets a <form action={...}> after every submission, so uncontrolled
// inputs (defaultValue) go blank even when the server returns a validation
// error. Submitting through onSubmit and calling the useActionState dispatch
// ourselves skips that automatic reset, so the user keeps what they typed.
//
//   const [state, formAction, pending] = useActionState(action, undefined);
//   const submit = useKeepValuesSubmit(formAction, handleSubmit);
//   <form onSubmit={submit}>…</form>
//
// `beforeSubmit` runs first (client-side checks); it cancels the submission by
// calling event.preventDefault() or returning false, as a plain onSubmit would.
export function useKeepValuesSubmit(
  formAction: (formData: FormData) => void,
  beforeSubmit?: (event: FormEvent<HTMLFormElement>) => boolean | void,
) {
  return useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      const cancelled = beforeSubmit?.(event) === false || event.defaultPrevented;
      event.preventDefault();
      if (cancelled) return;
      const formData = new FormData(event.currentTarget);
      startTransition(() => formAction(formData));
    },
    [formAction, beforeSubmit],
  );
}
