// index.js (Tệp mới - Điểm khởi đầu)

// Nhập khẩu class chính của extension từ tệp vừa tạo.
import { CharacterPhoneExtension } from './character-phone-extension.js';

(function() {
    'use strict';
    
    // Khởi tạo extension
    const extension = new CharacterPhoneExtension();

    // Gán extension vào window để các nút bấm trong HTML (onclick) có thể gọi được các hàm của nó
    window.characterPhone = extension;
    
    // Chạy hàm init() khi SillyTavern đã sẵn sàng
    jQuery(async () => {
        await extension.init();
    });
    
})();