import os
import logging
import cloudinary
import cloudinary.uploader
import requests
from dotenv import load_dotenv
from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import (
    Application, CommandHandler, MessageHandler, 
    ConversationHandler, filters, ContextTypes
)

load_dotenv()

# Настройки
BOT_TOKEN = os.getenv('BOT_TOKEN')
SHEETDB_URL = os.getenv('SHEETDB_URL')

cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)

logging.basicConfig(level=logging.INFO)

# Шаги диалога
PHOTO, NAME, BRAND, CATEGORY, PRICE, DESCRIPTION, STOCK = range(7)

CATEGORIES = ['kremlar', 'sogliq', 'vitaminlar', 'makiyaj', 'boshqa']

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Salom! Yangi mahsulot qo'shish uchun rasmini yuboring 📸"
    )
    return PHOTO

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("⏳ Rasm yuklanmoqda...")
    
    photo = update.message.photo[-1]
    file = await photo.get_file()
    file_url = file.file_path
    
    result = cloudinary.uploader.upload(file_url, folder="unity-beauty")
    context.user_data['image'] = result['secure_url']
    
    await update.message.reply_text("✅ Rasm yuklandi!\n\nMahsulot nomini kiriting:")
    return NAME

async def handle_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['name'] = update.message.text
    await update.message.reply_text("Brend nomini kiriting:")
    return BRAND

async def handle_brand(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['brand'] = update.message.text
    
    keyboard = [[cat] for cat in CATEGORIES]
    await update.message.reply_text(
        "Kategoriyani tanlang:",
        reply_markup=ReplyKeyboardMarkup(keyboard, one_time_keyboard=True)
    )
    return CATEGORY

async def handle_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['category'] = update.message.text
    await update.message.reply_text(
        "Narxini kiriting (faqat raqam, masalan: 35000):",
        reply_markup=ReplyKeyboardRemove()
    )
    return PRICE

async def handle_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['price'] = update.message.text
    await update.message.reply_text("Tavsif kiriting (yoki /skip):")
    return DESCRIPTION

async def handle_description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['description'] = update.message.text
    
    keyboard = [['Mavjud', 'Mavjud emas']]
    await update.message.reply_text(
        "Mavjudmi?",
        reply_markup=ReplyKeyboardMarkup(keyboard, one_time_keyboard=True)
    )
    return STOCK

async def skip_description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['description'] = ''
    
    keyboard = [['Mavjud', 'Mavjud emas']]
    await update.message.reply_text(
        "Mavjudmi?",
        reply_markup=ReplyKeyboardMarkup(keyboard, one_time_keyboard=True)
    )
    return STOCK

async def handle_stock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    in_stock = update.message.text == 'Mavjud'
    data = context.user_data
    
    payload = {
        "data": [{
            "id": str(__import__('time').time_ns()),
            "name": data['name'],
            "brand": data['brand'],
            "category": data['category'],
            "price": data['price'],
            "inStock": str(in_stock),
            "image": data['image'],
            "description": data['description']
        }]
    }
    
    response = requests.post(
        SHEETDB_URL,
        json=payload,
        headers={'Content-Type': 'application/json'}
    )
    
    if response.status_code == 201:
        await update.message.reply_text(
            f"✅ Mahsulot qo'shildi!\n\n"
            f"📦 {data['name']} ({data['brand']})\n"
            f"💰 {data['price']} ₩\n"
            f"🖼 Rasm: {data['image']}\n\n"
            "Yangi mahsulot qo'shish uchun /start",
            reply_markup=ReplyKeyboardRemove()
        )
    else:
        await update.message.reply_text("❌ Xato yuz berdi. Qayta urinib ko'ring /start")
    
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Bekor qilindi. Qayta boshlash uchun /start",
        reply_markup=ReplyKeyboardRemove()
    )
    return ConversationHandler.END

def main():
    app = Application.builder().token(BOT_TOKEN).build()
    
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler('start', start)],
        states={
            PHOTO: [MessageHandler(filters.PHOTO, handle_photo)],
            NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_name)],
            BRAND: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_brand)],
            CATEGORY: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_category)],
            PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_price)],
            DESCRIPTION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_description),
                CommandHandler('skip', skip_description)
            ],
            STOCK: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_stock)],
        },
        fallbacks=[CommandHandler('cancel', cancel)]
    )
    
    app.add_handler(conv_handler)
    app.run_polling()

if __name__ == '__main__':
    main()