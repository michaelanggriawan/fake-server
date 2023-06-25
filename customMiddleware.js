const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);

module.exports = (req, res, next) => {
  if (req.url === '/cart/items' && req.method === 'GET') {
    const menus = db.get('menus').value();
    const cartItems = db.get('cart').value();

    const populatedCartItems = cartItems.map((item) => {
      const menu = menus.find((menu) => menu.id === item.menuId);
      return {
        ...item,
        name: menu.name,
        image: menu.image,
        price: menu.price,
      };
    });

    return res.json({
      status: 200,
      success: true,
      error: null,
      data: populatedCartItems
    });
  }

  if (req.url.includes('/menus')) {
    const menus = db.get('menus').value();

    // Retrieve query parameters
    const page = parseInt(req.query?.page) || 1;
    const limit = parseInt(req.query?.limit) || 8;

    // Calculate total number of pages
    const totalPages = Math.ceil(menus.length / limit);

    // Calculate start and end indices based on the page and limit
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    // Slice the menus array based on the start and end indices
    const paginatedMenus = menus.slice(startIndex, endIndex);
    return res.json({
      statusCode: 200,
      success: true,
      error: null,
      data: paginatedMenus,
      meta: {
        pagination: {
          page,
          limit,
          totalPages,
          isLastPage: page === totalPages
        }
      }
    });
  }

  if (req.url === '/cart/items' && req.method === 'POST') {
    const { menuId, quantity } = req.body;
    const menus = db.get('menus').value();
    const cart = db.get('cart').value();

    // Check if the item already exists in the cart
    const existingItem = cart.find(item => item.menuId === menuId);

    // If the item exists, update its quantity
    if (existingItem) {
      const menu = menus.find(menu => menu.id === menuId);
      existingItem.quantity += quantity;
      existingItem.amount = existingItem.amount + (menu.price * quantity);
      const updatedItem = {
        ...existingItem,
        name: menu.name,
        image: menu.image,
        price: menu.price
      };
      db.write();
      return res.json({
        status: 200,
        success: true,
        error: null,
        data: updatedItem
      });
    } else {
      // If the item doesn't exist, add it to the cart
      const menu = menus.find(menu => menu.id === menuId);
      const newItem = {
        id: cart.length + 1,
        menuId,
        quantity,
        amount: menu.price
      };
      cart.push(newItem);
      db.write();
      return res.json({
        status: 200,
        success: true,
        error: null,
        data: { ...newItem, name: menu.name, price: menu.price, image: menu.image }
      });
    }
  }

  if (req.url.includes('/cart/items') && req.method === 'PUT') {
    const { menuId, quantity } = req.body;
    const menus = db.get('menus').value();
    const cart = db.get('cart').value();

    // Check if the item exists in the cart
    const existingItem = cart.find(item => item.menuId === menuId);

    // If the item exists, reduce its quantity
    if (existingItem) {
      const menu = menus.find(menu => menu.id === menuId);
      existingItem.quantity -= quantity;
      existingItem.amount = existingItem.amount - (menu.price * quantity);
      const updatedItem = {
        ...existingItem,
        name: menu.name,
        image: menu.image,
        price: menu.price
      };

      // Remove the item from the cart if the quantity reaches zero
      if (existingItem.quantity === 0) {
        const itemIndex = cart.findIndex(item => item.menuId === menuId);
        cart.splice(itemIndex, 1);
      }

      db.write();
      return res.json({
        status: 200,
        success: true,
        error: null,
        data: updatedItem
      });
    }

    return res.status(404).json({
      status: 404,
      success: false,
      error: 'Item not found in cart',
      data: null
    });
  }

  if (req.url === '/orders' && req.method === 'GET') {
    const orders = db.get('orders').value();

    return res.json({
      status: 200,
      success: true,
      error: null,
      data: orders
    });
  }

  if (req.url === '/orders' && req.method === 'POST') {
    const { customerName, items } = req.body;

    // Calculate the total amount for the order
    const totalAmount = items.reduce((total, item) => {
      const menu = db.get('menus').find({ id: item.menuId }).value();
      return total + item.quantity * menu.price;
    }, 0);

    // Generate a new ID for the order
    const orderId = db.get('orders').size().value() + 1;

    // Create a new order object
    const newOrder = {
      id: orderId,
      customerName,
      items,
      totalAmount
    };

    // Store the new order in the database
    db.get('orders').push(newOrder).write();

    // Clean the cart data related to the cart items
    const cartIds = items.map((item) => item.id);
    db.get('cart').remove((cartItem) => cartIds.includes(cartItem.id)).write();

    return res.json({
      status: 200,
      success: true,
      error: null,
      data: newOrder
    });
  }

  if (req.url.includes('/order') && req.method === 'GET') {
    const orderId = parseInt(req.url.split('/').pop());
    const orders = db.get('orders').value();
    const order = orders.find((item) => item.id === orderId);

    return res.json({
      status: 200,
      success: true,
      error: null,
      data: order || null
    })
  }

  next();
};
