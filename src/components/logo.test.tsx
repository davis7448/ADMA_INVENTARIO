import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Logo } from './logo';

describe('Logo Component', () => {
  it('should render the logo with the text "ADMA"', () => {
    render(<Logo />);
    
    // Busca el elemento que contiene el texto "ADMA"
    const logoText = screen.getByText('ADMA');
    
    // Verifica que el elemento exista en el documento
    expect(logoText).toBeInTheDocument();
  });
});
