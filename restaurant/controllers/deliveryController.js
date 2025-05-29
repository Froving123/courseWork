const mysql = require("mysql");

const conn = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Sasha228",
  database: "BRC",
});

class DeliveryController {
  async getCategories(req, res) {
    try {
      const query = `SELECT ID, Наименование FROM Категория_блюда WHERE Статус_удаления = 0 ORDER BY ID`;

      conn.query(query, (err, results) => {
        if (err) {
          console.error("Ошибка при получении категорий блюд:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при получении категорий",
          });
        }

        res.status(200).json({ success: true, categories: results });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async getPriceList(req, res) {
    try {
      const query = `
            SELECT 
                Прайс_лист.ID, 
                Прайс_лист.ID_блюда, 
                Прайс_лист.Цена, 
                Прайс_лист.Дата
            FROM 
                Прайс_лист
            WHERE 
                Прайс_лист.ID IN (
                    SELECT MAX(Прайс_лист.ID)
                    FROM Прайс_лист
                    GROUP BY Прайс_лист.ID_блюда
                )
            ORDER BY 
                Прайс_лист.ID_блюда;
        `;

      conn.query(query, (err, results) => {
        if (err) {
          console.error(
            "Ошибка при получении данных из таблицы Прайс_лист:",
            err
          );
          return res
            .status(500)
            .json({ success: false, message: "Ошибка при получении данных" });
        }

        res.status(200).json({ success: true, priceList: results });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async getDiscountedItem(req, res) {
    try {
      const query = `
        SELECT 
            COALESCE(Прайс_лист.Цена - Спец_предложения.Размер_скидки, Прайс_лист.Цена) AS DiscountedPrice,
            Блюда.Название AS DishName
        FROM 
            Прайс_лист
        LEFT JOIN 
            Спец_предложения ON Прайс_лист.ID_блюда = Спец_предложения.ID_блюда
            AND Спец_предложения.Дата_окончания >= CURRENT_DATE
            AND Спец_предложения.Статус_удаления = 0
        JOIN 
            Блюда ON Прайс_лист.ID_блюда = Блюда.ID
        WHERE 
            Спец_предложения.Размер_скидки IS NOT NULL
            AND Прайс_лист.ID = (
                SELECT MAX(ID)
                FROM Прайс_лист AS PL
                WHERE PL.ID_блюда = Прайс_лист.ID_блюда
            )
        ORDER BY 
            DiscountedPrice ASC
        LIMIT 1;
      `;

      conn.query(query, (err, results) => {
        if (err) {
          console.error(
            "Ошибка при получении блюда с минимальной ценой со скидкой:",
            err
          );
          return res.status(500).json({
            success: false,
            message:
              "Ошибка при получении блюда с минимальной ценой со скидкой",
          });
        }

        if (results.length > 0) {
          const { DiscountedPrice, DishName } = results[0];
          res.status(200).json({
            success: true,
            price: DiscountedPrice,
            dishName: DishName,
          });
        } else {
          res.status(200).json({
            success: false,
            message: "Нет доступных блюд со скидкой",
          });
        }
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async getMenu(req, res) {
    try {
      const query = `
        SELECT 
            Блюда.ID,
            Блюда.Название,
            Блюда.Фото,
            Категория_блюда.Наименование AS Категория,
            Прайс_лист.Цена AS Цена_без_скидки,
            COALESCE(Прайс_лист.Цена - Спец_предложения.Размер_скидки, Прайс_лист.Цена) AS Цена_со_скидкой,
            Спец_предложения.Размер_скидки AS Скидка
        FROM 
            Блюда
        JOIN 
            Категория_блюда ON Блюда.ID_категории = Категория_блюда.ID
        JOIN 
            Прайс_лист ON Прайс_лист.ID = (
                SELECT MAX(Прайс_лист.ID)
                FROM Прайс_лист 
                WHERE Прайс_лист.ID_блюда = Блюда.ID
            )
        LEFT JOIN 
            Спец_предложения ON Блюда.ID = Спец_предложения.ID_блюда
            AND Спец_предложения.Дата_окончания >= CURRENT_DATE
            AND Спец_предложения.Статус_удаления = 0
        WHERE 
            Блюда.Статус_удаления = 0
        ORDER BY 
            Категория_блюда.ID, Блюда.ID;
      `;

      conn.query(query, (err, results) => {
        if (err) {
          console.error("Ошибка при получении меню с учетом скидок:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при получении меню с учетом скидок",
          });
        }

        res.status(200).json({ success: true, menu: results });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async userDelivery(req, res) {
    try {
      const { userId } = req.query;

      const query = `
            SELECT 
                Заказ.ID AS ID_заказа, 
                Заказы.Дата, 
                Блюда.Название, 
                Прайс_лист.Цена
            FROM 
                Заказы
            JOIN 
                Блюда_в_заказе ON Заказы.ID = Блюда_в_заказе.ID_заказа
            JOIN 
                Блюда ON Блюда_в_заказе.ID_блюда = Блюда.ID
            JOIN 
                Прайс_лист ON Прайс_лист.ID = (
                    SELECT MAX(Прайс_лист.ID)
                    FROM Прайс_лист
                    WHERE Прайс_лист.ID_блюда = Блюда.ID
                )
            WHERE 
                Заказы.ID_пользователя = ?
        `;

      conn.query(query, [userId], (err, results) => {
        if (err) {
          console.error("Ошибка при получении заказов пользователя:", err);
          return res
            .status(500)
            .json({ success: false, message: "Ошибка при получении заказов" });
        }

        res.status(200).json({ success: true, orders: results });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }
}

module.exports = new DeliveryController();
