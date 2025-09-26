import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/AntLayout', () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout-mock">{children}</div>,
}));

jest.mock('./pages/RoomList', () => ({
  __esModule: true,
  default: () => <h1>房间列表</h1>,
}));

test('首页展示房间列表标题', () => {
  render(<App />);
  expect(screen.getByText('房间列表')).toBeInTheDocument();
});
