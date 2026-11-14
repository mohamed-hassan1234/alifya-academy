import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from './index';
import { Input } from '@/components/ui/form-controls';

describe('FormField', () => {
  it('links label, hint and error to the control', () => {
    render(
      <FormField label="Email" hint="We never share it" error="Enter a valid email address">
        <Input />
      </FormField>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email address');
  });
});
