import { render, screen } from '@testing-library/react';
import Home from '../page';

describe('Home Page', () => {
  it('renders the Next.js logo', () => {
    render(<Home />);

    const logo = screen.getByAltText('Next.js logo');

    expect(logo).toBeInTheDocument();
  });

  it('renders the get started text', () => {
    render(<Home />);

    const text = screen.getByText(/get started by editing/i);

    expect(text).toBeInTheDocument();
  });

  it('renders the read docs link', () => {
    render(<Home />);

    const link = screen.getByRole('link', {
      name: /read our docs/i,
    });

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      'https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app'
    );
  });
});
