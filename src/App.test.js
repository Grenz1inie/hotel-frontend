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

jest.mock('./pages/HotelLanding', () => ({
  __esModule: true,
  default: ({ onEnterRooms }) => (
    <div>
      <h1>酒店概览</h1>
      <button type="button" onClick={onEnterRooms}>进入房间列表</button>
    </div>
  ),
}));

test('首页展示酒店概览标题', () => {
  render(<App />);
  expect(screen.getByText('酒店概览')).toBeInTheDocument();
});
